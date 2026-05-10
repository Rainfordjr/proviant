import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function StockPage() {
  await requirePermission("inventory.view");

  const supabase = await createClient();

  const { data: materials } = await supabase
    .from("raw_materials")
    .select("*, suppliers(name)")
    .eq("is_active", true)
    .order("name");

  // Get active lots with upcoming expiry
  const { data: lots } = await supabase
    .from("material_lots")
    .select("*, raw_materials(name, unit)")
    .gt("quantity_remaining", 0)
    .order("expiry_date", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Levels</h1>
          <p className="text-sm text-gray-500">Current inventory of raw materials and active lots</p>
        </div>
        <Link
          href="/inventory/lots/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} /> Receive Lot
        </Link>
      </div>

      {/* Stock summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Materials</p>
          <p className="text-2xl font-bold text-gray-900">{(materials || []).length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Low Stock Items</p>
          <p className="text-2xl font-bold text-red-600">
            {(materials || []).filter((m: any) => m.current_stock <= m.reorder_point).length}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Active Lots</p>
          <p className="text-2xl font-bold text-gray-900">{(lots || []).length}</p>
        </div>
      </div>

      {/* Materials table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Material Stock Levels</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Material</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Supplier</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Current Stock</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Reorder Point</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(materials || []).map((mat: any) => {
              const pct = mat.reorder_point > 0
                ? Math.min(100, Math.round((mat.current_stock / (mat.reorder_point * 2)) * 100))
                : 100;
              const isLow = mat.current_stock <= mat.reorder_point;
              const barColor = isLow ? "bg-red-500" : pct > 60 ? "bg-green-500" : "bg-yellow-500";

              return (
                <tr key={mat.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{mat.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{mat.suppliers?.name || "—"}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{mat.current_stock} {mat.unit}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{mat.reorder_point} {mat.unit}</td>
                  <td className="px-6 py-4 w-40">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-gray-200">
                        <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-8">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Active lots */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Active Lots (by expiry date)</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Lot Number</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Material</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Remaining</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Expiry Date</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Days Left</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(lots || []).map((lot: any) => {
              const daysLeft = lot.expiry_date
                ? Math.ceil((new Date(lot.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null;
              const isExpired = daysLeft !== null && daysLeft < 0;
              const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;

              return (
                <tr key={lot.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium">
                    <Link href={`/inventory/lots/${lot.id}`} className="text-blue-600 hover:text-blue-800">
                      {lot.lot_number}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{lot.raw_materials?.name || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{lot.quantity_remaining} {lot.raw_materials?.unit || ""}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{lot.expiry_date ? formatDate(lot.expiry_date) : "N/A"}</td>
                  <td className="px-6 py-4 text-sm">
                    {daysLeft === null ? "—" : isExpired ? (
                      <span className="font-medium text-red-600">Expired</span>
                    ) : isExpiringSoon ? (
                      <span className="font-medium text-red-600">{daysLeft} days</span>
                    ) : (
                      <span className="text-gray-700">{daysLeft} days</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
