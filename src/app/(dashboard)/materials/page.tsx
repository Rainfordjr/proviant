import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import Link from "next/link";
import { Plus, AlertTriangle } from "lucide-react";
import { ALLERGENS } from "@/lib/constants";

export default async function MaterialsPage() {
  await requirePermission("materials.view");
  const canCreate = await checkPermission("materials.create");

  const supabase = await createClient();

  const { data: materials } = await supabase
    .from("raw_materials")
    .select("*, suppliers(name)")
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Raw Materials</h1>
          <p className="text-sm text-gray-500">Manage ingredients and raw materials inventory</p>
        </div>
        {canCreate && (
          <Link href="/materials/new"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={16} /> Add Material
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Material</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Vendor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Storage</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Cost</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Stock</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Allergens</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(materials || []).map((mat: any) => {
                const isLow = mat.current_stock <= mat.reorder_point;
                const allergenLabels = (mat.allergens || []).map((key: string) => {
                  const found = ALLERGENS.find((a) => a.value === key);
                  return found ? found.label : key;
                });

                return (
                  <tr key={mat.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <Link href={`/materials/${mat.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                        {mat.name}
                      </Link>
                      {mat.item_code && (
                        <span className="ml-2 text-xs text-gray-400">{mat.item_code}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">
                      {mat.suppliers?.name ? (
                        <Link href={`/vendors/${mat.supplier_id}`} className="text-blue-600 hover:text-blue-800">
                          {mat.suppliers.name}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">{mat.category || "—"}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{mat.storage_requirements || "—"}</td>
                    <td className="px-4 py-4 text-sm text-gray-900 font-medium">
                      {mat.cost != null ? `$${Number(mat.cost).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-medium text-gray-900">{mat.current_stock}</span>
                      <span className="text-sm text-gray-500"> {mat.unit}</span>
                      {isLow && (
                        <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-red-600">
                          <AlertTriangle size={10} /> Low
                        </span>
                      )}
                    </td>
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
                      {mat.is_active ? (
                        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Active</span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">Inactive</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(materials || []).length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">
                    No materials yet. Add your first material to get started.
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
