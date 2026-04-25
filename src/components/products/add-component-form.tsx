"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { UnitSelect } from "@/components/ui/unit-select";

export function AddComponentForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [componentType, setComponentType] = useState<"recipe" | "product">("recipe");
  const [recipeId, setRecipeId] = useState("");
  const [componentProductId, setComponentProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("each");
  const [notes, setNotes] = useState("");

  const [recipes, setRecipes] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [{ data: r }, { data: p }] = await Promise.all([
        supabase.from("recipes").select("id, name, yield_unit").eq("is_active", true).order("name"),
        supabase.from("products").select("id, name, sku, unit").eq("is_active", true).neq("id", productId).order("name"),
      ]);
      setRecipes(r || []);
      setProducts(p || []);
    };
    if (open) load();
  }, [open, productId]);

  // Auto-set unit when recipe/product changes
  useEffect(() => {
    if (componentType === "recipe" && recipeId) {
      const recipe = recipes.find((r) => r.id === recipeId);
      if (recipe) setUnit(recipe.yield_unit);
    } else if (componentType === "product" && componentProductId) {
      const prod = products.find((p) => p.id === componentProductId);
      if (prod) setUnit(prod.unit);
    }
  }, [componentType, recipeId, componentProductId, recipes, products]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const row: any = {
      product_id: productId,
      component_type: componentType,
      quantity: parseFloat(quantity) || 1,
      unit,
      notes: notes || null,
    };

    if (componentType === "recipe") {
      if (!recipeId) { setError("Select a recipe."); setLoading(false); return; }
      row.recipe_id = recipeId;
      row.component_product_id = null;
    } else {
      if (!componentProductId) { setError("Select a product."); setLoading(false); return; }
      row.component_product_id = componentProductId;
      row.recipe_id = null;
    }

    const { error: insertError } = await supabase.from("product_components").insert(row);
    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    // Reset and close
    setRecipeId("");
    setComponentProductId("");
    setQuantity("1");
    setUnit("each");
    setNotes("");
    setOpen(false);
    router.refresh();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors w-full justify-center"
      >
        <Plus size={16} /> Add Component
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Add a Component</h3>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-12 gap-3 items-end">
        {/* Type */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
          <select value={componentType} onChange={(e) => setComponentType(e.target.value as "recipe" | "product")}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
            <option value="recipe">Recipe</option>
            <option value="product">Product</option>
          </select>
        </div>

        {/* Source */}
        <div className="col-span-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {componentType === "recipe" ? "Recipe" : "Product"}
          </label>
          {componentType === "recipe" ? (
            <select value={recipeId} onChange={(e) => setRecipeId(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
              <option value="">Select recipe...</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>{r.name} (yields {r.yield_unit})</option>
              ))}
            </select>
          ) : (
            <select value={componentProductId} onChange={(e) => setComponentProductId(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
              <option value="">Select product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          )}
        </div>

        {/* Quantity */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Quantity</label>
          <input type="number" step="any" min="0" value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
        </div>

        {/* Unit */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
          <UnitSelect
            value={unit}
            onChange={setUnit}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* Actions */}
        <div className="col-span-2 flex gap-2">
          <button type="submit" disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? "..." : "Add"}
          </button>
          <button type="button" onClick={() => setOpen(false)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
