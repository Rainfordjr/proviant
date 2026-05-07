import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import Link from "next/link";
import { MapPin, Truck, User, Hash, Plus } from "lucide-react";

export default async function DeliveryRoutesPage() {
  await requirePermission("customers.view");
  const canEdit = await checkPermission("customers.edit");

  const supabase = await createClient();

  const { data: routes } = await supabase
    .from("delivery_routes")
    .select(`
      id, name, description, day_of_week, driver_name, is_active,
      delivery_route_stops (
        id, stop_order, notes,
        customers ( id, name, address, city, state )
      )
    `)
    .order("name", { ascending: true });

  const active = (routes || []).filter((r: any) => r.is_active);
  const inactive = (routes || []).filter((r: any) => !r.is_active);

  function sortedStops(stops: any[]) {
    return [...stops].sort((a, b) => a.stop_order - b.stop_order);
  }

  function RouteCard({ route }: { route: any }) {
    const stops = sortedStops(route.delivery_route_stops || []);
    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <Link href={`/customers/routes/${route.id}`}
              className="text-base font-semibold text-blue-600 hover:text-blue-800">
              {route.name}
            </Link>
            {route.description && (
              <p className="mt-0.5 text-sm text-gray-500">{route.description}</p>
            )}
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            route.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
          }`}>
            {route.is_active ? "Active" : "Inactive"}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1 px-6 py-3 text-sm text-gray-600">
          {route.day_of_week && (
            <span className="flex items-center gap-1.5">
              <Truck size={13} className="text-gray-400" />
              {route.day_of_week}
            </span>
          )}
          {route.driver_name && (
            <span className="flex items-center gap-1.5">
              <User size={13} className="text-gray-400" />
              {route.driver_name}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Hash size={13} className="text-gray-400" />
            {stops.length} stop{stops.length !== 1 ? "s" : ""}
          </span>
        </div>

        {stops.length > 0 ? (
          <ol className="divide-y divide-gray-100 px-6 pb-4">
            {stops.map((stop: any, i: number) => (
              <li key={stop.id} className="flex items-start gap-3 py-3">
                <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  {stop.customers ? (
                    <Link href={`/customers/${stop.customers.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800">
                      {stop.customers.name}
                    </Link>
                  ) : (
                    <span className="text-sm text-gray-400 italic">Unknown customer</span>
                  )}
                  {stop.customers?.address && (
                    <p className="text-xs text-gray-500">
                      {stop.customers.address}
                      {stop.customers.city ? `, ${stop.customers.city}` : ""}
                      {stop.customers.state ? `, ${stop.customers.state}` : ""}
                    </p>
                  )}
                  {stop.notes && (
                    <p className="mt-0.5 text-xs text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 inline-block">
                      {stop.notes}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-6 pb-4 text-sm text-gray-400 italic">No stops yet.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delivery Routes</h1>
          <p className="text-sm text-gray-500">Customer delivery runs and stop order</p>
        </div>
        {canEdit && (
          <Link href="/customers/routes/new"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={16} /> New Route
          </Link>
        )}
      </div>

      {(routes || []).length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <MapPin size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-900">No delivery routes yet</h3>
          <p className="mt-1 text-sm text-gray-500">Create your first route to organize customer deliveries.</p>
          {canEdit && (
            <Link href="/customers/routes/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Plus size={16} /> New Route
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            {active.map((route: any) => (
              <RouteCard key={route.id} route={route} />
            ))}
          </div>

          {inactive.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
                Inactive Routes
              </h2>
              <div className="grid gap-6 sm:grid-cols-2">
                {inactive.map((route: any) => (
                  <RouteCard key={route.id} route={route} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
