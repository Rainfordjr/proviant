"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChefHat, Package, Trash2, Plus, Pencil, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { UnitSelect } from "@/components/ui/unit-select";

interface Props {
  productId: string;
  components: any[];
  canEdit: boolean;
}

export function ProductComponentsSection({ productId, components: initial, canEdit }: Props) {
  const router = useRouter();
  const [components, setComponents] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCompType, setNewCompType] = useState<"recipe" | "product">("product");
  const [newRecipeId, setNewRecipeId] = useState("");
  const [newProductId, setNewProductId] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newUnit, setNewUnit] = useState("each");

  // Lookup data
  const [recipes, setRecipes] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [lookupsLoaded, setLookupsLoaded] = useState(false);

  // Inline qty editing
  const [editingQty, setEditingQty] = useState<string | null>(null);
  const [draftQty, setDraftQty] = useState("");

  useEffect(() => {
    setComponents(initial);
  }, [initial]);

  // Load lookups when add form opens
  useEffect(() => {
    if (!showAddForm || lookupsLoaded) return;
    const load = async () => {
      const supabase = createClient();
      const [{ data: r }, { data: p }] = await Promise.all([
        supabase.from("recipes").select("id, name, yield_unit").eq("is_active", true).order("name"),
        supabase.from("products").select("id, name, sku, unit").eq("is_active", true).neq("id", productId).order("name"),
      ]);
      setRecipes(r || []);
      setProducts(p || []);
      setLookupsLoaded(true);
    };
    load();
  }, [showAddForm, lookupsLoaded, productId]);

  // Auto-set unit
  useEffect(() => {
    if (newCompType === "recipe" && newRecipeId) {
      const r = recipes.find((r) => r.id === newRecipeId);
      if (r) setNewUnit(r.yield_unit);
    } else if (newCompType === "product" && newProductId) {
      const p = products.find((p) => p.id === newProductId);
      if (p) setNewUnit(p.unit);
    }
  }, [newCompType, newRecipeId, newProductId, recipes, products]);

  const removeComponent = async (compId: string) => {
    const supabase = createClient();
    const { error: delErr } = await supabase
      .from("product_components")
      .delete()
      .eq("id", compId);
    if (delErr) {
      setError("Failed to remove: " + delErr.message);
      return;
    }
    setComponents((prev) => prev.filter((c) => c.id !== compId));
    router.refresh();
  };

  const saveQty = async (compId: string) => {
    const qty = parseFloat(draftQty);
    if (isNaN(qty) || qty <= 0) {
      setEditingQty(null);
      return;
    }

    const supabase = createClient();
    const { error: updErr } = await supabase
      .from("product_components")
      .update({ quantity: qty })
      .eq("id", compId);

    if (updErr) {
      setError("Failed to update quantity: " + updErr.message);
    } else {
      setComponents((prev) =>
        prev.map((c) => (c.id === compId ? { ...c, quantity: qty } : c))
      );
    }
    setEditingQty(null);
  };

  const addComponent = async () => {
    setError(null);
    const supabase = createClient();

    const row: any = {
      product_id: productId,
      component_type: newCompType,
      quantity: parseFloat(newQty) || 1,
      unit: newUnit,
    };

    if (newCompType === "recipe") {
      if (!newRecipeId) { setError("Select a recipe."); return; }
      row.recipe_id = newRecipeId;
      row.component_product_id = null;
    } else {
      if (!newProductId) { setError("Select a product."); return; }
      row.component_product_id = newProductId;
      row.recipe_id = null;
    }

    const { data: inserted, error: insErr } = await supabase
      .from("product_components")
      .insert(row)
      .select()
      .single();

    if (insErr) { setError(insErr.message); return; }

    // Build display info
    let enriched: any = { ...inserted };
    if (newCompType === "recipe") {
      const r = recipes.find((r) => r.id === newRecipeId);
      enriched.recipe = r ? { id: r.id, name: r.name, yield_unit: r.yield_unit } : null;
    } else {
      const p = products.find((p) => p.id === newProductId);
      enriched.child_product = p ? { id: p.id, name: p.name, sku: p.sku } : null;
    }

    setComponents((prev) => [...prev, enriched]);
    setNewRecipeId("");
    setNewProductId("");
    setNewQty("1");
    setNewUnit("each");
    setShowAddForm(false);
    router.refresh();
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">What's Inside This Product</h2>
          <p className="text-sm text-gray-500">Recipe outputs or other products that make up this product</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700 mb-4">
          {error}
        </div>
      )}

      {components.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">
          No components defined yet.{canEdit ? " Add a recipe output or another product below." : ""}
        </p>
      ) : (
        <table className="w-full mb-4">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Type</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Component</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Quantity</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Unit</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Notes</th>
              {canEdit && <th className="px-4 py-2 w-10"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {components.map((comp: any) => (
              <tr key={comp.id} className="hover:bg-gray-50 group">
                <td className="px-4 py-3 text-sm">
                  {comp.component_type === "recipe" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                      <ChefHat size={12} /> Recipe
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      <Package size={12} /> Product
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {comp.component_type === "recipe" && comp.recipe ? (
                    <Link href={`/recipes/${comp.recipe.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                      {comp.recipe.name}
                    </Link>
                  ) : comp.child_product ? (
                    <Link href={`/products/${comp.child_product.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                      {comp.child_product.name} <span className="text-gray-400">({comp.child_product.sku})</span>
                    </Link>
                  ) : (
                    <span className="text-gray-400">Unknown</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {canEdit && editingQty === comp.id ? (
                    <span className="inline-flex items-center gap-1">
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        value={draftQty}
                        onChange={(e) => setDraftQty(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); saveQty(comp.id); }
                          if (e.key === "Escape") setEditingQty(null);
                        }}
                        autoFocus
                        className="w-20 rounded border border-blue-300 px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button onClick={() => saveQty(comp.id)} className="p-0.5 text-green-600 hover:bg-green-50 rounded">
                        <Check size={12} />
                      </button>
                      <button onClick={() => setEditingQty(null)} className="p-0.5 text-gray-400 hover:bg-gray-100 rounded">
                        <X size={12} />
                      </button>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      {comp.quantity}
                      {canEdit && (
                        <button
                          onClick={() => { setEditingQty(comp.id); setDraftQty(String(comp.quantity)); }}
                          className="p-0.5 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                          title="Edit quantity"
                        >
                          <Pencil size={11} />
                        </button>
                      )}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{comp.unit}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{comp.notes || "—"}</td>
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => removeComponent(comp.id)}
                      className="rounded p-1 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all"
                      title="Remove component"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add component */}
      {canEdit && (
        <>
          {showAddForm ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
              <div className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                  <select value={newCompType} onChange={(e) => setNewCompType(e.target.value as "recipe" | "product")}
                    className="block w-full rounded-lg border border-gray-300 px-2 py-2 text-sm bg-white">
                    <option value="recipe">Recipe</option>
                    <option value="product">Product</option>
                  </select>
                </div>
                <div className="col-span-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {newCompType === "recipe" ? "Recipe" : "Product"}
                  </label>
                  {newCompType === "recipe" ? (
                    <select value={newRecipeId} onChange={(e) => setNewRecipeId(e.target.value)}
                      className="block w-full rounded-lg border border-gray-300 px-2 py-2 text-sm bg-white">
                      <option value="">Select...</option>
                      {recipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  ) : (
                    <select value={newProductId} onChange={(e) => setNewProductId(e.target.value)}
                      className="block w-full rounded-lg border border-gray-300 px-2 py-2 text-sm bg-white">
                      <option value="">Select...</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                    </select>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Qty</label>
                  <input type="number" step="any" min="0" value={newQty} onChange={(e) => setNewQty(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-2 py-2 text-sm bg-white" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
                  <UnitSelect value={newUnit} onChange={setNewUnit}
                    className="block w-full rounded-lg border border-gray-300 px-2 py-2 text-sm bg-white" />
                </div>
                <div className="col-span-2 flex gap-2">
                  <button type="button" onClick={addComponent}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
                    Add
                  </button>
                  <button type="button" onClick={() => setShowAddForm(false)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors w-full justify-center"
            >
              <Plus size={16} /> Add Component
            </button>
          )}
        </>
      )}
    </div>
  );
}
