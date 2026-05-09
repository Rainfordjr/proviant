import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ALLERGENS } from "@/lib/constants";

export default async function IngredientsPage() {
  await requirePermission("ingredients.view");
  const canCreate = await checkPermission("ingredients.create");

  const supabase = await createClient();

  const { data: ingredients } = await supabase
    .from("ingredients")
    .select("*, raw_materials(id)")
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ingredients</h1>
          <p className="text-sm text-gray-500">Abstract recipe ingredients. One ingredient can be sourced from multiple vendor SKUs (raw materials).</p>
        </div>
        {canCreate && (
          <Link href="/ingredients/new"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={16} /> Add Ingredient
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Unit</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"># Materials</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Allergens</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(ingredients || []).map((ing: any) => {
                const matCount = (ing.raw_materials || []).length;
                const allergenLabels = (ing.allergens || []).map((key: string) => {
                  const found = ALLERGENS.find((a) => a.value === key);
                  return found ? found.label : key;
                });

                return (
                  <tr key={ing.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <Link href={`/ingredients/${ing.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                        {ing.name}
                      </Link>
                      {ing.description && (
                        <p className="mt-0.5 text-xs text-gray-500">{ing.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">{ing.unit}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{matCount}</td>
                    <td className="px-4 py-4">
                      {allergenLabels.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {allergenLabels.map((label: string) => (
                            <span key={label} className="rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">
                              {label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {ing.is_active ? (
                        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Active</span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">Inactive</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(ingredients || []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    No ingredients yet. Add your first ingredient to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
