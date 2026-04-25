import { createClient } from "@/lib/supabase/server";
import { Package, ShieldCheck, Warehouse, Truck, AlertTriangle, TrendingUp } from "lucide-react";
import Link from "next/link";
import { BATCH_STATUSES } from "@/lib/constants";

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        </div>
        <div className={`rounded-lg p-3 ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </div>
  );
}

function AlertCard({
  title,
  message,
  type,
}: {
  title: string;
  message: string;
  type: "warning" | "danger" | "info";
}) {
  const colors = {
    warning: "border-yellow-200 bg-yellow-50",
    danger: "border-red-200 bg-red-50",
    info: "border-blue-200 bg-blue-50",
  };
  const iconColors = {
    warning: "text-yellow-600",
    danger: "text-red-600",
    info: "text-blue-600",
  };

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${colors[type]}`}>
      <AlertTriangle size={20} className={iconColors[type]} />
      <div>
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch recent batches with recipe and product names
  const { data: recentBatches } = await supabase
    .from("batches")
    .select("*, recipes(name), products(name)")
    .order("created_at", { ascending: false })
    .limit(5);

  // Count active batches
  const { count: activeBatchCount } = await supabase
    .from("batches")
    .select("*", { count: "exact", head: true })
    .in("status", ["planned", "in_progress"]);

  // Fetch low stock materials
  const { data: allMaterials } = await supabase
    .from("raw_materials")
    .select("*")
    .eq("is_active", true);

  const lowStock = (allMaterials || []).filter(
    (m) => m.current_stock <= m.reorder_point
  );

  // Count pending orders
  const { count: pendingOrderCount } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .in("status", ["pending", "confirmed", "processing"]);

  // Fetch expiring lots (within 30 days)
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const { data: expiringLots } = await supabase
    .from("material_lots")
    .select("*, raw_materials(name)")
    .gt("quantity_remaining", 0)
    .lte("expiry_date", thirtyDaysFromNow.toISOString().split("T")[0])
    .order("expiry_date", { ascending: true });

  // Count today's compliance logs
  const today = new Date().toISOString().split("T")[0];
  const { count: todayLogCount } = await supabase
    .from("compliance_logs")
    .select("*", { count: "exact", head: true })
    .gte("recorded_at", today);

  // Build alerts
  const alerts: { title: string; message: string; type: "warning" | "danger" | "info" }[] = [];

  (expiringLots || []).forEach((lot: any) => {
    const daysUntil = Math.ceil(
      (new Date(lot.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    alerts.push({
      type: daysUntil <= 7 ? "danger" : "warning",
      title: `${lot.raw_materials?.name || "Material"} Lot #${lot.lot_number} Expiring`,
      message: `Expires in ${daysUntil} days. ${lot.quantity_remaining} remaining.`,
    });
  });

  lowStock.forEach((mat) => {
    alerts.push({
      type: "warning",
      title: `Low Stock: ${mat.name}`,
      message: `Current: ${mat.current_stock} ${mat.unit}. Reorder point: ${mat.reorder_point} ${mat.unit}.`,
    });
  });

  if ((todayLogCount || 0) === 0) {
    alerts.push({
      type: "info",
      title: "No Compliance Logs Today",
      message: "No temperature or safety checks have been recorded today.",
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Here is what is happening with your operations today.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Batches"
          value={activeBatchCount || 0}
          subtitle={`${(recentBatches || []).filter((b) => b.status === "completed").length} completed recently`}
          icon={Package}
          color="bg-blue-600"
        />
        <StatCard
          title="Compliance Logs Today"
          value={todayLogCount || 0}
          subtitle="Temperature, sanitation, CCP"
          icon={ShieldCheck}
          color="bg-green-600"
        />
        <StatCard
          title="Low Stock Items"
          value={lowStock.length}
          subtitle={lowStock.length > 0 ? "Reorder recommended" : "All stocked up"}
          icon={Warehouse}
          color={lowStock.length > 0 ? "bg-yellow-500" : "bg-green-500"}
        />
        <StatCard
          title="Pending Orders"
          value={pendingOrderCount || 0}
          subtitle="Awaiting fulfillment"
          icon={Truck}
          color="bg-purple-600"
        />
      </div>

      {/* Two-column: Recent Batches + Alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Batches</h2>
            <Link href="/batches" className="text-sm text-blue-600 hover:text-blue-800">View all &rarr;</Link>
          </div>
          <div className="mt-4 space-y-3">
            {(recentBatches || []).length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No batches yet. Create your first batch to get started.</p>
            ) : (
              (recentBatches || []).map((batch: any) => {
                const statusInfo = BATCH_STATUSES[batch.status as keyof typeof BATCH_STATUSES];
                return (
                  <Link key={batch.id} href={`/batches/${batch.id}`}
                    className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{batch.recipes?.name || batch.products?.name || "Unknown"}</p>
                      <p className="text-xs text-gray-500">{batch.batch_number}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo?.color || "bg-gray-100 text-gray-800"}`}>
                      {statusInfo?.label || batch.status}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Alerts</h2>
          <div className="mt-4 space-y-3">
            {alerts.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No alerts. Everything looks good!</p>
            ) : (
              alerts.slice(0, 5).map((alert, i) => <AlertCard key={i} {...alert} />)
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "New Batch", href: "/batches/new", icon: Package, color: "bg-blue-50 text-blue-700 hover:bg-blue-100" },
            { label: "Log Temperature", href: "/compliance/logs", icon: TrendingUp, color: "bg-green-50 text-green-700 hover:bg-green-100" },
            { label: "New Order", href: "/orders/new", icon: Truck, color: "bg-purple-50 text-purple-700 hover:bg-purple-100" },
            { label: "Stock Check", href: "/inventory/stock", icon: Warehouse, color: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100" },
          ].map((action) => (
            <Link key={action.label} href={action.href}
              className={`flex flex-col items-center gap-2 rounded-lg p-4 text-sm font-medium transition-colors ${action.color}`}>
              <action.icon size={24} />
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
