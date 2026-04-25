import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import Link from "next/link";
import { Plus, Warehouse, MapPin } from "lucide-react";
import { checkPermission } from "@/lib/permissions";

export default async function WarehousePage() {
  await requirePermission("warehouse.view");
  const canCreate = await checkPermission("warehouse.create");
  const supabase = await createClient();

  const { data: sites } = await supabase
    .from("warehouse_sites")
    .select("*, warehouse_zones(id)")
    .order("name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Warehouse Sites</h1>
          <p className="text-sm text-gray-500">Manage your facility layouts and bin locations</p>
        </div>
        {canCreate && (
          <Link
            href="/warehouse/new"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} /> New Site
          </Link>
        )}
      </div>

      {(sites || []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Warehouse size={40} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No warehouse sites yet</h3>
          <p className="text-sm text-gray-500 mb-4">Create your first site to start mapping your facility.</p>
          {canCreate && (
            <Link
              href="/warehouse/new"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={16} /> Create Site
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(sites || []).map((site: any) => {
            const zoneCount = site.warehouse_zones?.length || 0;
            return (
              <Link
                key={site.id}
                href={`/warehouse/${site.id}`}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Warehouse size={20} />
                  </div>
                  <span className="text-xs text-gray-400">{site.grid_rows}×{site.grid_cols} grid</span>
                </div>
                <h3 className="text-sm font-semibold text-gray-900">{site.name}</h3>
                {site.address && (
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <MapPin size={10} /> {site.address}
                  </p>
                )}
                {site.description && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{site.description}</p>
                )}
                <div className="mt-3 text-xs text-gray-500">
                  {zoneCount} zone{zoneCount !== 1 ? "s" : ""}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
