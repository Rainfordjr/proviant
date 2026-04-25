"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, Plus, ChefHat, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRequirePermission } from "@/lib/usePermission";
import { UnitSelect } from "@/components/ui/unit-select";

export default function EditProductPage() {
  const { loading: permLoading } = useRequirePermission("products.edit");
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);

  // Product fields
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [upc, setUpc] = useState("");
  const [gtin, setGtin] = useState("");
  const [unit, setUnit] = useState("units");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Components
  const [components, setComponents] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // New component form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCompType, setNewCompType] = useState<"recipe" | "product">("product");
  const [newRecipeId, setNewRecipeId] = useState("");
  const [newProductId, setNewProductId] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newUnit, setNewUnit] = useState("each");

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      const [
        { data: product },
        { data: cats },
        { data: comps },
        { data: allRecipes },
        { data: allProducts },
      ] = await Promise.all([
        supabase.from("products").select("*").eq("id", id).single(),
        supabase.from("product_categories").select("id, name").eq("is_active", true).order("name"),
        supabase.from("product_components").select("*").eq("product_id", id),
        supabase.from("recipes").select("id, name, yield_unit").eq("is_active", true).order("name"),
        supabase.from("products").select("id, name, sku, unit").eq("is_active", true).neq("id", id).order("name"),
      ]);

      if (!product) {
        setError("Product not found.");
        setLoading(false);
        return;
      }

      setName(product.name);
      setSku(product.sku);
      setUpc(product.upc || "");
      setGtin(product.gtin || "");
      setUnit(product.unit);
      setCategoryId(product.category_id || "");
      setDescription(product.description || "");
      setIsActive(product.is_active);
      setCategories(cats || []);
      setRecipes(allRecipes || []);
      setProducts(allProducts || []);

      // Enrich components
      const enriched = await Promise.all(
        (comps || []).map(async (c: any) => {
          if (c.component_type === "recipe" && c.recipe_id) {
            const { data: r } = await supabase.from("recipes").select("id, name").eq("id", c.recipe_id).single();
            return { ...c, _label: r?.name || "Unknown recipe" };
          } else if (c.component_type === "product" && c.component_product_id) {
            const { data: p } = await supabase.from("products").select("id, name, sku").eq("id", c.component_product_id).single();
            return { ...c, _label: p ? `${p.name} (${p.sku})` : "Unknown product" };
          }
          return { ...c, _label: "Unknown" };
        })
      );

      setComponents(enriched);
      setLoading(false);
    };
    load();
  }, [id]);

  // Auto-set unit on new component selection
  useEffect(() => {
    if (newCompType === "recipe" && newRecipeId) {
      const r = recipes.find((r) => r.id === newRecipeId);
      if (r) setNewUnit(r.yield_unit);
    } else if (newCompType === "product" && newProductId) {
      const p = products.find((p) => p.id === newProductId);
      if (p) setNewUnit(p.unit);
    }
  }, [newCompType, newRecipeId, newProductId, recipes, products]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();

    const { error: updateErr } = await supabase
      .from("products")
      .update({
        name,
        sku,
        upc: upc || null,
        gtin: gtin || null,
        unit,
        category_id: categoryId || null,
        category: categories.find((c) => c.id === categoryId)?.name || "general",
        description: description || null,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    setSaving(false);

    if (updateErr) {
      if (updateErr.message.includes("duplicate") || updateErr.message.includes("unique")) {
        setError("A product with that SKU, UPC, or GTIN already exists.");
      } else {
        setError(updateErr.message);
      }
      return;
    }

    router.push(`/products/${id}`);
    router.refresh();
  };

  const removeComponent = async (compId: string) => {
    const supabase = createClient();
    const { error: delErr } = await supabase
      .from("product_components")
      .delete()
      .eq("id", compId);

    if (delErr) {
      setError("Failed to remove component: " + delErr.message);
      return;
    }

    setComponents((prev) => prev.filter((c) => c.id !== compId));
  };

  const updateComponentQty = async (compId: string, newQuantity: string) => {
    const qty = parseFloat(newQuantity);
    if (isNaN(qty) || qty <= 0) return;

    const supabase = createClient();
    const { error: updErr } = await supabase
      .from("product_components")
      .update({ quantity: qty })
      .eq("id", compId);

    if (updErr) {
      setError("Failed to update quantity: " + updErr.message);
      return;
    }

    setComponents((prev) =>
      prev.map((c) => (c.id === compId ? { ...c, quantity: qty } : c))
    );
  };

  const addComponent = async () => {
    const supabase = createClient();

    const row: any = {
      product_id: id,
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

    if (insErr) {
      setError(insErr.message);
      return;
    }

    // Build label for display
    let label = "Unknown";
    if (newCompType === "recipe") {
      const r = recipes.find((r) => r.id === newRecipeId);
      label = r?.name || "Unknown recipe";
    } else {
      const p = products.find((p) => p.id === newProductId);
      label = p ? `${p.name} (${p.sku})` : "Unknown product";
    }

    setComponents((prev) => [...prev, { ...inserted, _label: label }]);
    setNewRecipeId("");
    setNewProductId("");
    setNewQty("1");
    setNewUnit("each");
    setShowAddForm(false);
  };

  if (permLoading || loading) {
    return <div className="p-8 text-center text-sm text-gray-500">Loading...</div>;
  }

  const inputClass = "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/products/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={16} /> Back to Product
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
        <p className="text-sm text-gray-500">Update product details and components</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {/* Product details */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">Product Details</h2>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Product Name *</label>
            <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="sku" className="block text-sm font-medium text-gray-700">SKU *</label>
              <input id="sku" type="text" required value={sku} onChange={(e) => setSku(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="unit" className="block text-sm font-medium text-gray-700">Unit *</label>
              <UnitSelect id="unit" value={unit} onChange={setUnit} required showPlaceholder={false} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="upc" className="block text-sm font-medium text-gray-700">UPC</label>
              <input id="upc" type="text" value={upc} onChange={(e) => setUpc(e.target.value)}
                placeholder="12-digit code" className={inputClass} />
            </div>
            <div>
              <label htmlFor="gtin" className="block text-sm font-medium text-gray-700">GTIN</label>
              <input id="gtin" type="text" value={gtin} onChange={(e) => setGtin(e.target.value)}
                placeholder="14-digit code" className={inputClass} />
            </div>
          </div>

          <div>
            <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700">Category</label>
            <select id="categoryId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
            <textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
          </div>

          <div className="flex items-center gap-2">
            <input id="isActive" type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
          </div>
        </div>

        {/* Components */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Components</h2>
            <p className="text-sm text-gray-500">What goes inside this product</p>
          </div>

          {components.length === 0 ? (
            <p className="text-sm text-gray-400 py-3 text-center">No components yet.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Component</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500 w-28">Qty</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Unit</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {components.map((comp) => (
                  <tr key={comp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      {comp.component_type === "recipe" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                          <ChefHat size={10} /> Recipe
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          <Package size={10} /> Product
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{comp._label}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        defaultValue={comp.quantity}
                        onBlur={(e) => updateComponentQty(comp.id, e.target.value)}
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{comp.unit}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeComponent(comp.id)}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Remove component"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Add new component */}
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
              type="button"
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors w-full justify-center"
            >
              <Plus size={16} /> Add Component
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link href={`/products/${id}`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
          <button type="submit" disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
