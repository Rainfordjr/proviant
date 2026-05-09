"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Material = { id: string; name: string; suppliers?: { name: string } | null };
type SubRow = { id: string; raw_material_id: string; raw_materials?: { name: string; suppliers?: { name: string } | null } };

interface Props {
  recipeId: string;
  ingredients: { id: string; name: string; unit: string }[];
  /** existing rules keyed by ingredient_id */
  initialSubsByIngredient: Record<string, SubRow[]>;
  /** all candidate materials keyed by ingredient_id */
  materialsByIngredient: Record<string, Material[]>;
  canEdit: boolean;
}

export function RecipeSubstitutionsEditor({
  recipeId, ingredients, initialSubsByIngredient, materialsByIngredient, canEdit,
}: Props) {
  const router = useRouter();
  const [subs, setSubs] = useState(initialSubsByIngredient);
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const supabase = createClient();

  const addRule = async (ingredientId: string, rawMaterialId: string) => {
    setBusy(true);
    const { data, error } = await supabase
      .from("recipe_ingredient_substitutions")
      .insert({ recipe_id: recipeId, ingredient_id: ingredientId, raw_material_id: rawMaterialId })
      .select("id, ingredient_id, raw_material_id, raw_materials(name, suppliers(name))")
      .single();
    setBusy(false);
    if (error) { alert(error.message); return; }
    const next = { ...subs };
    next[ingredientId] = [...(next[ingredientId] || []), data as any];
    setSubs(next);
    setOpenPicker(null);
    router.refresh();
  };

  const removeRule = async (ingredientId: string, ruleId: string) => {
    setBusy(true);
    const { error } = await supabase
      .from("recipe_ingredient_substitutions")
      .delete()
      .eq("id", ruleId);
    setBusy(false);
    if (error) { alert(error.message); return; }
    const next = { ...subs };
    next[ingredientId] = (next[ingredientId] || []).filter((r) => r.id !== ruleId);
    setSubs(next);
    router.refresh();
  };

  if (ingredients.length === 0) {
    return <p className="text-sm text-gray-500">No ingredients on the current version yet.</p>;
  }

  return (
    <div className="space-y-3">
      {ingredients.map((ing) => {
        const rules = subs[ing.id] || [];
        const allMats = materialsByIngredient[ing.id] || [];
        const usedIds = new Set(rules.map((r) => r.raw_material_id));
        const candidates = allMats.filter((m) => !usedIds.has(m.id));
        const isOpen = openPicker === ing.id;

        return (
          <div key={ing.id} className="rounded-lg border border-gray-200 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900">{ing.name}</div>
                {rules.length === 0 ? (
                  <p className="mt-1 text-xs text-gray-500">
                    Any active vendor SKU under this ingredient is allowed (no restriction).
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {rules.map((r) => (
                      <span key={r.id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                        {r.raw_materials?.name || "(removed)"}
                        {r.raw_materials?.suppliers?.name && (
                          <span className="text-blue-500">· {r.raw_materials.suppliers.name}</span>
                        )}
                        {canEdit && (
                          <button onClick={() => removeRule(ing.id, r.id)} disabled={busy}
                            className="rounded-full p-0.5 hover:bg-blue-100" title="Remove">
                            <X size={12} />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {canEdit && candidates.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOpenPicker(isOpen ? null : ing.id)}
                  className="flex-shrink-0 inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Plus size={12} /> Restrict
                </button>
              )}
            </div>
            {isOpen && (
              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-1">
                <p className="text-xs text-blue-900 mb-2 font-medium">Allow only these materials:</p>
                {candidates.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => addRule(ing.id, m.id)}
                    disabled={busy}
                    className="w-full text-left text-sm text-gray-800 hover:bg-blue-100 rounded px-2 py-1 disabled:opacity-50"
                  >
                    {m.name}
                    {m.suppliers?.name && <span className="text-xs text-gray-500"> · {m.suppliers.name}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
