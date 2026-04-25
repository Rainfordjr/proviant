import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import Link from "next/link";
import { Plus } from "lucide-react";
import { BATCH_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export default async function BatchesPage() {
  await requirePermission("batches.view");
  const canCreate = await checkPermission("batches.create");

  const supabase = await createClient();

  const { data: batches } = await supabase
    .from("batches")
    .select("*, recipes(name), products(name, sku)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Batches</h1>
          <p className="text-sm text-gray-500">Manage production batches and lot tracking</p>
        </div>
        {canCreate && (
          <Link href="/batches/new"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
            <Plus size={16} /> New Batch
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Batch Number</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Recipe</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Product</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Qty Produced</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(batches || []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                  No batches yet. Click &quot;New Batch&quot; to create your first production run.
                </td>
              </tr>
            ) : (
              (batches || []).map((batch: any) => {
                const statusInfo = BATCH_STATUSES[batch.status as keyof typeof BATCH_STATUSES];
                return (
                  <tr key={batch.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/batches/${batch.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                        {batch.batch_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {batch.recipes?.name ? (
                        <Link href={`/recipes/${batch.recipe_id}`} className="text-gray-900 hover:text-blue-600">
                          {batch.recipes.name}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {batch.products?.name || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo?.color || "bg-gray-100 text-gray-800"}`}>
                        {statusInfo?.label || batch.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{batch.quantity_produced ?? "—"}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {batch.produced_at ? formatDate(batch.produced_at) : "In progress"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/batches/${batch.id}`} className="text-sm text-gray-500 hover:text-gray-900">View &rarr;</Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
