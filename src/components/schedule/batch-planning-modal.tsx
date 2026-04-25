"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { X, ChefHat, Package, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { generateBatchNumber, toDateString } from "@/lib/utils";
import type { Product, Recipe, User as UserType, Equipment, ProductComponent } from "@/types";

interface ProductAllocation {
  productId: string;
  quantity: string;
}

interface BatchPlanningModalProps {
  products: Product[];
  recipes: Recipe[];
  users: UserType[];
  equipment: Equipment[];
  productComponents: ProductComponent[];
  defaultDate?: Date | null;
  onClose: () => void;
}

export function BatchPlanningModal({
  products,
  recipes,
  users,
  equipment,
  productComponents,
  defaultDate,
  onClose,
}: BatchPlanningModalProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [scheduledDate, setScheduledDate] = useState(
    defaultDate ? toDateString(defaultDate) : toDateString(new Date())
  );
  const [recipeId, setRecipeId] = useState("");
  const [totalQuantity, setTotalQuantity] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [assignedTo, setAssignedTo] = useState("");
  const [duration, setDuration] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  // Product allocations
  const [allocations, setAllocations] = useState<ProductAllocation[]>([]);

  // When a recipe is selected, find the products that use it
  const productsForRecipe = useMemo(() => {
    if (!recipeId) return [];
    const productIds = new Set(
      productComponents
        .filter((pc) => pc.component_type === "recipe" && pc.recipe_id === recipeId)
        .map((pc) => pc.product_id)
    );
    return products.filter((p) => productIds.has(p.id));
  }, [recipeId, productComponents, products]);

  // Selected recipe object
  const selectedRecipe = useMemo(
    () => recipes.find((r) => r.id === recipeId) || null,
    [recipeId, recipes]
  );

  // Available products (not yet allocated)
  const availableProducts = useMemo(
    () => productsForRecipe.filter((p) => !allocations.some((a) => a.productId === p.id)),
    [productsForRecipe, allocations]
  );

  // Total allocated quantity
  const allocatedTotal = useMemo(
    () => allocations.reduce((sum, a) => sum + (parseFloat(a.quantity) || 0), 0),
    [allocations]
  );

  function handleRecipeChange(newRecipeId: string) {
    setRecipeId(newRecipeId);
    setAllocations([]); // Reset allocations when recipe changes
  }

  function addAllocation() {
    if (availableProducts.length === 0) return;
    setAllocations((prev) => [
      ...prev,
      { productId: availableProducts[0].id, quantity: "" },
    ]);
  }

  function updateAllocation(index: number, field: keyof ProductAllocation, value: string) {
    setAllocations((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a))
    );
  }

  function removeAllocation(index: number) {
    setAllocations((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduledDate || !recipeId) return;

    setSaving(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated");
      setSaving(false);
      return;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      setError("User profile not found");
      setSaving(false);
      return;
    }

    // Create the batch — product_id is set to the first allocation's product if there's only one,
    // or null if multiple (the allocations table tracks the split)
    const primaryProductId =
      allocations.length === 1 ? allocations[0].productId : null;

    const { data: batch, error: insertError } = await supabase
      .from("batches")
      .insert({
        org_id: profile.org_id,
        batch_number: generateBatchNumber(),
        batch_type: "production",
        status: "planned",
        product_id: primaryProductId,
        recipe_id: recipeId,
        quantity_produced: totalQuantity ? parseFloat(totalQuantity) : null,
        scheduled_date: scheduledDate,
        priority,
        assigned_to: assignedTo || null,
        estimated_duration_hours: duration ? parseFloat(duration) : null,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    if (batch) {
      // Create product allocations
      const validAllocations = allocations.filter(
        (a) => a.productId && parseFloat(a.quantity) > 0
      );
      if (validAllocations.length > 0) {
        await supabase.from("batch_product_allocations").insert(
          validAllocations.map((a) => ({
            batch_id: batch.id,
            product_id: a.productId,
            quantity: parseFloat(a.quantity),
            unit: selectedRecipe?.yield_unit || "units",
          }))
        );
      }

      // Create equipment assignments
      if (selectedEquipment.length > 0) {
        await supabase.from("schedule_resource_assignments").insert(
          selectedEquipment.map((eqId) => ({
            batch_id: batch.id,
            resource_type: "equipment" as const,
            resource_id: eqId,
          }))
        );
      }
    }

    setSaving(false);
    onClose();
    router.refresh();
  }

  function toggleEquipment(eqId: string) {
    setSelectedEquipment((prev) =>
      prev.includes(eqId) ? prev.filter((id) => id !== eqId) : [...prev, eqId]
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Schedule Production Run</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} id="schedule-form" className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          )}

          {/* Recipe (required, first) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-1">
                <ChefHat size={14} />
                Recipe <span className="text-red-500">*</span>
              </span>
            </label>
            <select
              required
              value={recipeId}
              onChange={(e) => handleRecipeChange(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Choose a recipe…</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.yield_quantity ? ` (yields ${r.yield_quantity} ${r.yield_unit})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Recipe selected — show yield info */}
          {selectedRecipe && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-sm text-blue-800">
              <span className="font-medium">{selectedRecipe.name}</span>
              {selectedRecipe.yield_quantity && (
                <span className="ml-1">
                  — yields {selectedRecipe.yield_quantity} {selectedRecipe.yield_unit} per batch
                </span>
              )}
            </div>
          )}

          {/* Product allocations — only visible after recipe is selected */}
          {recipeId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center gap-1">
                  <Package size={14} />
                  Product Allocation
                </span>
              </label>

              {productsForRecipe.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-sm text-gray-500">
                  No products are linked to this recipe.
                  <br />
                  <span className="text-xs text-gray-400">
                    Link products to this recipe in the Products section first.
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  {allocations.map((alloc, index) => {
                    const product = products.find((p) => p.id === alloc.productId);
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2"
                      >
                        <select
                          value={alloc.productId}
                          onChange={(e) => updateAllocation(index, "productId", e.target.value)}
                          className="flex-1 min-w-0 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        >
                          {/* Show current selection + available products */}
                          {product && (
                            <option value={product.id}>
                              {product.name} ({product.sku})
                            </option>
                          )}
                          {availableProducts
                            .filter((p) => p.id !== alloc.productId)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku})
                              </option>
                            ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Qty"
                          value={alloc.quantity}
                          onChange={(e) => updateAllocation(index, "quantity", e.target.value)}
                          className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => removeAllocation(index)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-200 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}

                  {/* Add product button */}
                  {availableProducts.length > 0 && (
                    <button
                      type="button"
                      onClick={addAllocation}
                      className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 w-full justify-center transition-colors"
                    >
                      <Plus size={14} />
                      Add product
                    </button>
                  )}

                  {/* Allocation summary */}
                  {allocations.length > 0 && totalQuantity && (
                    <div className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-600">
                      <span>
                        Allocated: {allocatedTotal} / {totalQuantity}{" "}
                        {selectedRecipe?.yield_unit || "units"}
                      </span>
                      {allocatedTotal > parseFloat(totalQuantity) && (
                        <span className="text-red-600 font-medium">Over-allocated</span>
                      )}
                      {allocatedTotal < parseFloat(totalQuantity) && allocatedTotal > 0 && (
                        <span className="text-amber-600 font-medium">
                          {(parseFloat(totalQuantity) - allocatedTotal).toFixed(1)} unallocated
                        </span>
                      )}
                      {allocatedTotal === parseFloat(totalQuantity) && (
                        <span className="text-green-600 font-medium">Fully allocated</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scheduled Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Total batch quantity + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Batch Quantity
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={totalQuantity}
                onChange={(e) => setTotalQuantity(e.target.value)}
                placeholder={
                  selectedRecipe?.yield_quantity
                    ? `e.g. ${selectedRecipe.yield_quantity}`
                    : "e.g. 500"
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Est. Duration (hrs)
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 4"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Priority + Assigned To */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Equipment */}
          {equipment.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Equipment</label>
              <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                {equipment.map((eq) => (
                  <label
                    key={eq.id}
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEquipment.includes(eq.id)}
                      onChange={() => toggleEquipment(eq.id)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-gray-700">{eq.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{eq.equipment_type}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional production notes…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="schedule-form"
            disabled={saving || !recipeId}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Scheduling…" : "Schedule Batch"}
          </button>
        </div>
      </div>
    </div>
  );
}
