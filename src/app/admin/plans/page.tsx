import { createAdminClient } from "@/lib/platformAdmin";
import Link from "next/link";
import { Plus, Edit2, Star } from "lucide-react";

export default async function AdminPlansPage() {
  const supabase = createAdminClient();

  const { data: plans } = await supabase
    .from("plans")
    .select("*")
    .order("sort_order");

  // Count subscribers per plan
  const { data: subCounts } = await supabase
    .from("org_subscriptions")
    .select("plan_id");

  const countByPlan: Record<string, number> = {};
  (subCounts || []).forEach((s: any) => {
    if (s.plan_id) countByPlan[s.plan_id] = (countByPlan[s.plan_id] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Plans</h1>
          <p className="text-sm text-gray-500">Manage subscription tiers and pricing</p>
        </div>
        <Link
          href="/admin/plans/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} /> New Plan
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(plans || []).map((plan: any) => {
          const subs = countByPlan[plan.id] || 0;
          return (
            <div
              key={plan.id}
              className={`rounded-xl border p-5 transition-colors ${
                plan.is_active
                  ? "border-gray-700 bg-gray-900"
                  : "border-gray-800 bg-gray-900/50 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                  {plan.is_featured && <Star size={14} className="text-amber-400" />}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  plan.is_active ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-500"
                }`}>
                  {plan.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              {plan.badge && (
                <span className="inline-block rounded bg-blue-600/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-400 mb-2">
                  {plan.badge}
                </span>
              )}

              {plan.description && (
                <p className="text-sm text-gray-500 mb-3">{plan.description}</p>
              )}

              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-2xl font-bold text-white">
                  ${Number(plan.price_monthly).toFixed(2)}
                </span>
                <span className="text-sm text-gray-500">/month</span>
                {plan.price_yearly && (
                  <span className="text-xs text-gray-600 ml-2">
                    ${Number(plan.price_yearly).toFixed(2)}/yr
                  </span>
                )}
              </div>

              <div className="text-xs text-gray-500 space-y-1 border-t border-gray-800 pt-3 mb-4">
                <div className="flex justify-between">
                  <span>Users</span>
                  <span className="text-gray-400">{plan.max_users ?? "Unlimited"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Batches/mo</span>
                  <span className="text-gray-400">{plan.max_batches_per_month ?? "Unlimited"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Modules</span>
                  <span className="text-gray-400">{plan.included_modules?.length || 0} included</span>
                </div>
                <div className="flex justify-between">
                  <span>Subscribers</span>
                  <span className="text-gray-400">{subs}</span>
                </div>
                <div className="flex justify-between">
                  <span>Version</span>
                  <span className="text-gray-400">v{plan.current_version}</span>
                </div>
              </div>

              <Link
                href={`/admin/plans/${plan.id}`}
                className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium"
              >
                <Edit2 size={12} /> Edit Plan
              </Link>
            </div>
          );
        })}
      </div>

      {(!plans || plans.length === 0) && (
        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900 p-12 text-center">
          <p className="text-sm text-gray-500">No plans created yet.</p>
        </div>
      )}
    </div>
  );
}
