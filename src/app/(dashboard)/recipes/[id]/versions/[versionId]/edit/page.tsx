"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRequirePermission } from "@/lib/usePermission";
import { UnitSelect } from "@/components/ui/unit-select";
import {
  SectionedIngredientEditor,
  SectionedIngredients,
  newSectionKey,
} from "@/components/recipes/sectioned-ingredient-editor";

export default function EditVersionPage() {
  const { loading: permLoading } = useRequirePermission("recipes.edit");
  const router = useRouter();
  const params = useParams();
  const recipeId = params.id as string;
  const versionId = params.versionId as string;

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [recipe, setRecipe] = useState<any>(null);
  const [version, setVersion] = useState<any>(null);

  const [instructions, setInstructions] = useState("");
  const [yieldQuantity, setYieldQuantity] = useState("1");
  const [yieldUnit, setYieldUnit] = useState("each");
  const [changeNotes, setChangeNotes] = useState("");

  const [ingredientData, setIngredientData] = useState<SectionedIngredients>({
    unsectioned: [],
    sections: [],
  });

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      const [{ data: r }, { data: v }, { data: mats }] = await Promise.all([
        supabase.from("recipes").select("*").eq("id", recipeId).single(),
        supabase.from("recipe_versions").select("*").eq("id", versionId).eq("recipe_id", recipeId).single(),
        supabase.from("raw_materials").select("id, name, unit").eq("is_active", true).order("name"),
      ]);

      setRecipe(r);
      setVersion(v);
      setMaterials(mats || []);

      if (v) {
        if (v.status !== "draft") {
          router.replace(`/recipes/${recipeId}/versions/${versionId}`);
          return;
        }

        setYieldQuantity(String(v.yield_quantity));
        setYieldUnit(v.yield_unit);
        setInstructions(v.instructions || "");
        setChangeNotes(v.change_notes || "");

        // Load sections
        const { data: sections } = await supabase
          .from("recipe_version_sections")
          .select("*")
          .eq("recipe_version_id", versionId)
          .order("sort_order");

        // Load ingredients
        const { data: ings } = await supabase
          .from("recipe_version_ingredients")
          .select("*")
          .eq("recipe_version_id", versionId)
          .order("sort_order");

        const sectionMap = new Map<string, string>(); // db id → client key
        const loadedSections = (sections || []).map((sec: any) => {
          const key = newSectionKey();
          sectionMap.set(sec.id, key);
          return {
            key,
            dbId: sec.id,
            name: sec.name,
            notes: sec.notes || "",
            ingredients: [] as any[],
          };
        });

        const unsectioned: any[] = [];
        (ings || []).forEach((ing: any) => {
          const row = {
            raw_material_id: ing.raw_material_id,
            quantity: String(ing.quantity),
            unit: ing.unit,
            notes: ing.notes || "",
          };
          if (ing.section_id && sectionMap.has(ing.section_id)) {
            const secKey = sectionMap.get(ing.section_id)!;
            loadedSections.find((s) => s.key === secKey)?.ingredients.push(row);
          } else {
            unsectioned.push(row);
          }
        });

        setIngredientData({ unsectioned, sections: loadedSections });
      }

      setInitialLoading(false);
    };
    load();
  }, [recipeId, versionId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    // Update the version record
    const { error: vError } = await supabase
      .from("recipe_versions")
      .update({
        yield_quantity: parseFloat(yieldQuantity) || 1,
        yield_unit: yieldUnit,
        instructions: instructions || null,
        change_notes: changeNotes || null,
      })
      .eq("id", versionId);

    if (vError) { setError(vError.message); setLoading(false); return; }

    // Delete existing ingredients and sections (replace strategy)
    await supabase.from("recipe_version_ingredients").delete().eq("recipe_version_id", versionId);
    await supabase.from("recipe_version_sections").delete().eq("recipe_version_id", versionId);

    // Re-insert unsectioned ingredients
    let globalSortOrder = 0;
    const validUnsectioned = ingredientData.unsectioned.filter((i) => i.raw_material_id && i.quantity);
    if (validUnsectioned.length > 0) {
      const { error: ingErr } = await supabase.from("recipe_version_ingredients").insert(
        validUnsectioned.map((ing) => ({
          recipe_version_id: versionId,
          raw_material_id: ing.raw_material_id,
          quantity: parseFloat(ing.quantity),
          unit: ing.unit,
          notes: ing.notes || null,
          sort_order: globalSortOrder++,
          section_id: null,
        }))
      );
      if (ingErr) { setError("Version updated but ingredients failed: " + ingErr.message); setLoading(false); return; }
    }

    // Re-insert sections + their ingredients
    for (let sIdx = 0; sIdx < ingredientData.sections.length; sIdx++) {
      const section = ingredientData.sections[sIdx];
      if (!section.name.trim()) continue;

      const { data: sec, error: secErr } = await supabase
        .from("recipe_version_sections")
        .insert({
          recipe_version_id: versionId,
          name: section.name.trim(),
          notes: section.notes.trim() || null,
          sort_order: sIdx,
        })
        .select()
        .single();

      if (secErr) { setError("Section failed: " + secErr.message); setLoading(false); return; }

      const validIngs = section.ingredients.filter((i) => i.raw_material_id && i.quantity);
      if (validIngs.length > 0) {
        const { error: ingErr } = await supabase.from("recipe_version_ingredients").insert(
          validIngs.map((ing) => ({
            recipe_version_id: versionId,
            raw_material_id: ing.raw_material_id,
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

    setLoading(false);
    router.push(`/recipes/${recipeId}/versions/${versionId}`);
    router.refresh();
  };

  if (permLoading) return <div className="p-8 text-center text-sm text-gray-500">Checking permissions…</div>;

  if (initialLoading) {
    return <div className="text-sm text-gray-500 py-8 text-center">Loading...</div>;
  }

  if (!recipe || !version) {
    return <div className="text-sm text-red-500 py-8 text-center">Recipe or version not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/recipes/${recipeId}/versions/${versionId}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={16} /> Back to v{version.version_number}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          Edit Draft — {recipe.name} v{version.version_number}
        </h1>
        <p className="text-sm text-gray-500">
          Modify the ingredients, yield, or instructions for this draft version.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {/* Yield + Change Notes */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">Version Details</h2>

          <div>
            <label htmlFor="changeNotes" className="block text-sm font-medium text-gray-700">
              What changed? *
            </label>
            <textarea
              id="changeNotes" rows={2} required value={changeNotes}
              onChange={(e) => setChangeNotes(e.target.value)}
              placeholder="e.g., Increased chocolate chips from 15 to 18 lbs per batch"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="yieldQty" className="block text-sm font-medium text-gray-700">
                Yield Quantity *
              </label>
              <input
                id="yieldQty" type="number" step="any" min="0" required
                value={yieldQuantity} onChange={(e) => setYieldQuantity(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="yieldUnit" className="block text-sm font-medium text-gray-700">
                Yield Unit *
              </label>
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
        </div>

        {/* Sectioned ingredient editor */}
        <SectionedIngredientEditor
          data={ingredientData}
          onChange={setIngredientData}
          materials={materials}
        />

        {/* Instructions */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Instructions</h2>
          <textarea
            rows={6} value={instructions} onChange={(e) => setInstructions(e.target.value)}
            placeholder="Step-by-step production instructions..."
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/recipes/${recipeId}/versions/${versionId}`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit" disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
