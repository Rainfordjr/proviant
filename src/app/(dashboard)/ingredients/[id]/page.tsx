import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus, AlertTriangle } from "lucide-react";
import { notFound } from "next/navigation";
import { ALLERGENS } from "@/lib/constants";

export default async function IngredientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("ingredients.view");
  const canEdit = await checkPermission("ingredients.edit");
  const canCreateMaterial = await checkPermission("materials.create");

  const { id } = await params;
  const supabase = await createClient();

  const { data: ingredient } = await supabase
    .from("ingredients")
    .select("*")
    .eq("id", id)
    .single();

  if (!ingredient) return notFound();

  const { data: materials } = await supabase
    .from("raw_materials")
    .select("id, name, item_code, current_stock, reorder_point, unit, suppliers(id, name), is_active")
    .eq("ingredient_id", id)
    .order("name", { ascending: true });

  const { data: recipeIngs } = await supabase
    .from("recipe_ingredients")
    .select("recipe_id, quantity, unit, recipes(id, name, is_active)")
    .eq("ingredient_id", id);

  const allergenLabels = (ingredient.allergens || []).map((key: string) => {
    const found = ALLERGENS.find((a) => a.value === key);
    return found ? found.label : key;
  });

  // Dedupe recipes (an ingredient can appear multiple times in different sections)
  const recipeMap = new Map<string, { id: string; name: string; is_active: boolean }>();
  for (const ri of recipeIngs || []) {
    const r = (ri as any).recipes;
    if (r?.id && !recipeMap.has(r.id)) recipeMap.set(r.id, r);
  }
  const recipesUsing = Array.from(recipeMap.values());

  return (
    <div className="space-y-6">
      <div>
        <Link href="/ingredients" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={16} /> Back to Ingredients
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{ingredient.name}</h1>
            <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
              <span>Recipe unit: <strong>{ingredient.unit}</strong></span>
              {ingredient.is_active ? (
                <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Active</span>
              ) : (
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">Inactive</span>
              )}
            </div>
            {ingredient.description && (
              <p className="mt-2 text-sm text-gray-600 max-w-2xl">{ingredient.description}</p>
            )}
          </div>
          {canEdit && (
            <Link href={`/ingredients/${ingredient.id}/edit`}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Pencil size={14} /> Edit
            </Link>
          )}
        </div>
      </div>

      {/* Allergens */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Allergens</h2>
        {allergenLabels.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {allergenLabels.map((label: string) => (
              <span key={label} className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                {label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">None</p>
        )}
        <p className="mt-2 text-xs text-gray-500">All raw materials linked to this ingredient inherit these allergens.</p>
      </div>

      {/* Linked materials */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Vendor SKUs ({(materials || []).length})</h2>
          {canCreateMaterial && (
            <Link href={`/materials/new?ingredient_id=${ingredient.id}`}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
              <Plus size={13} /> Add Material
            </Link>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Material</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Vendor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Item Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Stock</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(materials || []).map((m: any) => {
                const isLow = m.current_stock <= m.reorder_point;
                return (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/materials/${m.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                        {m.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {m.suppliers?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{m.item_code || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-900">{m.current_stock}</span>
                      <span className="text-sm text-gray-500"> {m.unit}</span>
                      {isLow && (
                        <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-red-600">
                          <AlertTriangle size={10} /> Low
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {m.is_active ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Active</span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Inactive</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(materials || []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-6 text-center text-sm text-gray-500">
                    No materials linked yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recipes that use it */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Recipes using this ingredient ({recipesUsing.length})</h2>
        </div>
        {recipesUsing.length === 0 ? (
          <p className="px-6 py-6 text-center text-sm text-gray-500">No recipes reference this ingredient yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recipesUsing.map((r) => (
              <li key={r.id}>
                <Link href={`/recipes/${r.id}`}
                  className="flex items-center justify-between px-6 py-3 text-sm text-blue-600 hover:bg-gray-50 hover:text-blue-800">
                  <span>{r.name}</span>
                  {!r.is_active && <span className="text-xs text-gray-400">inactive</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
