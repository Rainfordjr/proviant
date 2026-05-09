"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRequirePermission } from "@/lib/usePermission";
import { UnitSelect } from "@/components/ui/unit-select";
import {
  SectionedIngredientEditor,
  SectionedIngredients,
  newSectionKey,
} from "@/components/recipes/sectioned-ingredient-editor";

export default function NewRecipePage() {
  const { loading: permLoading } = useRequirePermission("recipes.create");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ingredientOptions, setIngredientOptions] = useState<any[]>([]);
  const [existingProducts, setExistingProducts] = useState<any[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [yieldQuantity, setYieldQuantity] = useState("1");
  const [yieldUnit, setYieldUnit] = useState("each");
  const [changeNotes, setChangeNotes] = useState("");

  // Output product fields
  const [productMode, setProductMode] = useState<"new" | "existing">("new");
  const [productName, setProductName] = useState("");
  const [productSku, setProductSku] = useState("");
  const [existingProductId, setExistingProductId] = useState("");

  const [ingredientData, setIngredientData] = useState<SectionedIngredients>({
    unsectioned: [{ ingredient_id: "", quantity: "", unit: "", notes: "" }],
    sections: [],
  });

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [{ data: ings }, { data: prods }] = await Promise.all([
        supabase.from("ingredients").select("id, name, unit").eq("is_active", true).order("name"),
        supabase.from("products").select("id, name, sku").eq("is_active", true).order("name"),
      ]);
      setIngredientOptions(ings || []);
      setExistingProducts(prods || []);
    };
    load();
  }, []);

  // Auto-sync product name with recipe name (only for new products, if user hasn't manually edited)
  const [productNameTouched, setProductNameTouched] = useState(false);
  useEffect(() => {
    if (productMode === "new" && !productNameTouched && name) {
      setProductName(name);
    }
  }, [name, productMode, productNameTouched]);

  // Auto-generate SKU from product name
  useEffect(() => {
    if (productMode === "new" && productName) {
      const sku = productName
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, "")
        .trim()
        .split(/\s+/)
        .slice(0, 4)
        .map((w) => w.slice(0, 4))
        .join("-");
      setProductSku(sku);
    }
  }, [productName, productMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("You must be logged in."); setLoading(false); return; }

    const { data: profile } = await supabase
      .from("users").select("org_id").eq("id", user.id).single();
    if (!profile) { setError("Could not find your organization."); setLoading(false); return; }

    // 1. Create the recipe first (recipe is the parent)
    const { data: recipe, error: recipeError } = await supabase
      .from("recipes")
      .insert({
        org_id: profile.org_id,
        name,
        description: description || null,
        instructions: instructions || null,
        yield_quantity: parseFloat(yieldQuantity) || 1,
        yield_unit: yieldUnit,
      })
      .select()
      .single();

    if (recipeError) { setError(recipeError.message); setLoading(false); return; }

    // 2. Create or link the output product (product references the recipe)
    if (productMode === "existing") {
      if (!existingProductId) { setError("Please select an existing product."); setLoading(false); return; }
      const { error: linkErr } = await supabase
        .from("products")
        .update({ recipe_id: recipe.id })
        .eq("id", existingProductId);
      if (linkErr) { setError("Recipe created but failed to link product: " + linkErr.message); setLoading(false); return; }
    } else {
      if (!productName.trim()) { setError("Please enter a name for the output product."); setLoading(false); return; }

      const { error: prodErr } = await supabase
        .from("products")
        .insert({
          org_id: profile.org_id,
          name: productName.trim(),
          sku: productSku.trim() || "AUTO-" + Date.now(),
          unit: yieldUnit,
          is_active: true,
          product_type: "production",
          recipe_id: recipe.id,
        })
        .select()
        .single();

      if (prodErr) {
        if (prodErr.message.includes("duplicate") || prodErr.message.includes("unique")) {
          setError("A product with that SKU already exists. Please change the SKU or select an existing product.");
        } else {
          setError("Failed to create product: " + prodErr.message);
        }
        setLoading(false);
        return;
      }
    }

    // 2. Create draft version (v1)
    const { data: version, error: versionError } = await supabase
      .from("recipe_versions")
      .insert({
        recipe_id: recipe.id,
        version_number: 1,
        status: "draft",
        yield_quantity: parseFloat(yieldQuantity) || 1,
        yield_unit: yieldUnit,
        instructions: instructions || null,
        change_notes: changeNotes || "Initial version",
        created_by: user.id,
      })
      .select()
      .single();

    if (versionError) {
      setError("Recipe created but failed to create version: " + versionError.message);
      setLoading(false);
      return;
    }

    // 3. Create sections and insert ingredients
    let globalSortOrder = 0;

    const validUnsectioned = ingredientData.unsectioned.filter((i) => i.ingredient_id && i.quantity);
    if (validUnsectioned.length > 0) {
      const { error: ingErr } = await supabase.from("recipe_version_ingredients").insert(
        validUnsectioned.map((ing) => ({
          recipe_version_id: version.id,
          ingredient_id: ing.ingredient_id,
          quantity: parseFloat(ing.quantity),
          unit: ing.unit,
          notes: ing.notes || null,
          sort_order: globalSortOrder++,
          section_id: null,
        }))
      );
      if (ingErr) { setError("Version created but ingredients failed: " + ingErr.message); setLoading(false); return; }
    }

    for (let sIdx = 0; sIdx < ingredientData.sections.length; sIdx++) {
      const section = ingredientData.sections[sIdx];
      if (!section.name.trim()) continue;

      const { data: sec, error: secErr } = await supabase
        .from("recipe_version_sections")
        .insert({
          recipe_version_id: version.id,
          name: section.name.trim(),
          notes: section.notes.trim() || null,
          sort_order: sIdx,
        })
        .select()
        .single();

      if (secErr) { setError("Section failed: " + secErr.message); setLoading(false); return; }

      const validIngs = section.ingredients.filter((i) => i.ingredient_id && i.quantity);
      if (validIngs.length > 0) {
        const { error: ingErr } = await supabase.from("recipe_version_ingredients").insert(
          validIngs.map((ing) => ({
            recipe_version_id: version.id,
            ingredient_id: ing.ingredient_id,
            quantity: parseFloat(ing.quantity),
            unit: ing.unit,
            notes: ing.notes || null,
            sort_order: globalSortOrder++,
            section_id: sec.id,
          }))
        );
        if (ingErr) { setError("Section ingredients failed: " + ingErr.message); setLoading(false); return; }
      }
    }

    // Also insert into old recipe_ingredients for backward compat
    const allIngredients = [
      ...ingredientData.unsectioned,
      ...ingredientData.sections.flatMap((s) => s.ingredients),
    ].filter((i) => i.ingredient_id && i.quantity);
    if (allIngredients.length > 0) {
      await supabase.from("recipe_ingredients").insert(
        allIngredients.map((ing, idx) => ({
          recipe_id: recipe.id,
          ingredient_id: ing.ingredient_id,
          quantity: parseFloat(ing.quantity),
          unit: ing.unit,
          notes: ing.notes || null,
          sort_order: idx,
        }))
      );
    }

    setLoading(false);
    router.push(`/recipes/${recipe.id}`);
    router.refresh();
  };

  if (permLoading) return <div className="p-8 text-center text-sm text-gray-500">Checking permissions…</div>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/recipes" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={16} /> Back to Recipes
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Recipe</h1>
        <p className="text-sm text-gray-500">This will create a recipe with a draft v1. Submit it for review once you're ready.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {/* Basic info */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Recipe Name *</label>
            <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Chocolate Chip Muffin Top"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
            <textarea id="description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this recipe"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="yieldQty" className="block text-sm font-medium text-gray-700">Yield Quantity *</label>
              <input id="yieldQty" type="number" step="any" min="0" required
                value={yieldQuantity} onChange={(e) => setYieldQuantity(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label htmlFor="yieldUnit" className="block text-sm font-medium text-gray-700">Yield Unit *</label>
              <UnitSelect
                id="yieldUnit"
                value={yieldUnit}
                onChange={setYieldUnit}
                required
                showPlaceholder={false}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="changeNotes" className="block text-sm font-medium text-gray-700">Version Notes</label>
            <input id="changeNotes" type="text" value={changeNotes} onChange={(e) => setChangeNotes(e.target.value)}
              placeholder="e.g., Initial recipe"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>

        {/* Output Product */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ShoppingBag size={20} /> Output Product
            </h2>
            <p className="text-sm text-gray-500">Every recipe produces a product — the base unit that comes out of production.</p>
          </div>

          <div className="flex gap-3">
            <button type="button"
              onClick={() => setProductMode("new")}
              className={`rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${
                productMode === "new"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              }`}>
              Create New Product
            </button>
            <button type="button"
              onClick={() => setProductMode("existing")}
              className={`rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${
                productMode === "existing"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              }`}>
              Link Existing Product
            </button>
          </div>

          {productMode === "new" ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="productName" className="block text-sm font-medium text-gray-700">Product Name *</label>
                <input id="productName" type="text" required value={productName}
                  onChange={(e) => { setProductName(e.target.value); setProductNameTouched(true); }}
                  placeholder="e.g., Chocolate Chip Muffin Top"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <p className="mt-1 text-xs text-gray-400">Defaults to the recipe name. Edit if the product name differs.</p>
              </div>
              <div>
                <label htmlFor="productSku" className="block text-sm font-medium text-gray-700">SKU *</label>
                <input id="productSku" type="text" required value={productSku}
                  onChange={(e) => setProductSku(e.target.value)}
                  placeholder="Auto-generated"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <p className="mt-1 text-xs text-gray-400">Auto-generated from the product name. Edit as needed.</p>
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="existingProduct" className="block text-sm font-medium text-gray-700">Select Product *</label>
              <select id="existingProduct" required value={existingProductId}
                onChange={(e) => setExistingProductId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="">Select a product...</option>
                {existingProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Sectioned ingredient editor */}
        <SectionedIngredientEditor
          data={ingredientData}
          onChange={setIngredientData}
          ingredients={ingredientOptions}
        />

        {/* Instructions */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Instructions</h2>
          <textarea rows={6} value={instructions} onChange={(e) => setInstructions(e.target.value)}
            placeholder="Step-by-step production instructions..."
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/recipes"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
          <button type="submit" disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Creating..." : "Create Recipe (Draft v1)"}
          </button>
        </div>
      </form>
    </div>
  );
}
