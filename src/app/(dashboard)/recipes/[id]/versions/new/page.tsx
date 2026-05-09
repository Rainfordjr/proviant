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

export default function NewVersionPage() {
  const { loading: permLoading } = useRequirePermission("recipes.edit");
  const router = useRouter();
  const params = useParams();
  const recipeId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ingredientOptions, setIngredientOptions] = useState<any[]>([]);
  const [recipe, setRecipe] = useState<any>(null);
  const [nextVersion, setNextVersion] = useState(1);

  const [instructions, setInstructions] = useState("");
  const [yieldQuantity, setYieldQuantity] = useState("1");
  const [yieldUnit, setYieldUnit] = useState("each");
  const [changeNotes, setChangeNotes] = useState("");

  const [ingredientData, setIngredientData] = useState<SectionedIngredients>({
    unsectioned: [],
    sections: [],
  });

  // Load recipe, previous version data, and materials
  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      const [{ data: r }, { data: ings }] = await Promise.all([
        supabase.from("recipes").select("*").eq("id", recipeId).single(),
        supabase.from("ingredients").select("id, name, unit").eq("is_active", true).order("name"),
      ]);

      setRecipe(r);
      setIngredientOptions(ings || []);

      if (r) {
        // Get latest version number
        const { data: versions } = await supabase
          .from("recipe_versions")
          .select("version_number")
          .eq("recipe_id", recipeId)
          .order("version_number", { ascending: false })
          .limit(1);

        const latestNum = versions?.[0]?.version_number || 0;
        setNextVersion(latestNum + 1);

        // Copy from current approved version or latest version
        const sourceVersionId = r.current_version_id;
        if (sourceVersionId) {
          const { data: srcVersion } = await supabase
            .from("recipe_versions")
            .select("*")
            .eq("id", sourceVersionId)
            .single();

          if (srcVersion) {
            setYieldQuantity(String(srcVersion.yield_quantity));
            setYieldUnit(srcVersion.yield_unit);
            setInstructions(srcVersion.instructions || "");
          }

          // Load sections
          const { data: srcSections } = await supabase
            .from("recipe_version_sections")
            .select("*")
            .eq("recipe_version_id", sourceVersionId)
            .order("sort_order");

          // Load ingredients
          const { data: srcIngs } = await supabase
            .from("recipe_version_ingredients")
            .select("*")
            .eq("recipe_version_id", sourceVersionId)
            .order("sort_order");

          const sectionMap = new Map<string, string>(); // old section id → key
          const loadedSections = (srcSections || []).map((sec: any) => {
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
          (srcIngs || []).forEach((ing: any) => {
            const row = {
              ingredient_id: ing.ingredient_id,
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
        } else {
          // No approved version, copy from recipe-level data
          setYieldQuantity(String(r.yield_quantity));
          setYieldUnit(r.yield_unit);
          setInstructions(r.instructions || "");

          // Try old-style recipe_ingredients
          const { data: oldIngs } = await supabase
            .from("recipe_ingredients")
            .select("*")
            .eq("recipe_id", recipeId)
            .order("sort_order");

          if (oldIngs && oldIngs.length > 0) {
            setIngredientData({
              unsectioned: oldIngs.map((ing: any) => ({
                ingredient_id: ing.ingredient_id,
                quantity: String(ing.quantity),
                unit: ing.unit,
                notes: ing.notes || "",
              })),
              sections: [],
            });
          }
        }
      }

      setInitialLoading(false);
    };
    load();
  }, [recipeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("You must be logged in."); setLoading(false); return; }

    // Create draft version
    const { data: version, error: vError } = await supabase
      .from("recipe_versions")
      .insert({
        recipe_id: recipeId,
        version_number: nextVersion,
        status: "draft",
        yield_quantity: parseFloat(yieldQuantity) || 1,
        yield_unit: yieldUnit,
        instructions: instructions || null,
        change_notes: changeNotes || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (vError) { setError(vError.message); setLoading(false); return; }

    // Insert unsectioned ingredients
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

    // Insert sections + section ingredients
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

    setLoading(false);
    router.push(`/recipes/${recipeId}/versions/${version.id}`);
    router.refresh();
  };

  if (permLoading) return <div className="p-8 text-center text-sm text-gray-500">Checking permissions…</div>;

  if (initialLoading) {
    return <div className="text-sm text-gray-500 py-8 text-center">Loading...</div>;
  }

  if (!recipe) {
    return <div className="text-sm text-red-500 py-8 text-center">Recipe not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/recipes/${recipeId}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={16} /> Back to {recipe.name}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Draft — v{nextVersion}</h1>
        <p className="text-sm text-gray-500">
          Creating a new draft version of &quot;{recipe.name}&quot;. Edit the ingredients, yield, or instructions below.
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
            <label htmlFor="changeNotes" className="block text-sm font-medium text-gray-700">What changed? *</label>
            <textarea id="changeNotes" rows={2} required value={changeNotes} onChange={(e) => setChangeNotes(e.target.value)}
              placeholder="e.g., Increased chocolate chips from 15 to 18 lbs per batch"
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
          <Link href={`/recipes/${recipeId}`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
          <button type="submit" disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Creating..." : `Create Draft v${nextVersion}`}
          </button>
        </div>
      </form>
    </div>
  );
}
