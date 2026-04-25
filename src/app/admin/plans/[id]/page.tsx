import { createAdminClient } from "@/lib/platformAdmin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PlanEditor } from "@/components/admin/plan-editor";

export default async function AdminPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: plan } = await supabase
    .from("plans")
    .select("*")
    .eq("id", id)
    .single();

  if (!plan) return notFound();

  // Fetch version history
  const { data: versions } = await supabase
    .from("plan_versions")
    .select("*, users:created_by(full_name)")
    .eq("plan_id", id)
    .order("version", { ascending: false });

  // Fetch all non-core modules for the module picker
  const { data: modules } = await supabase
    .from("modules")
    .select("slug, name, is_core, price_monthly")
    .order("sort_order");

  // Count orgs on this plan
  const { count: subscriberCount } = await supabase
    .from("org_subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("plan_id", id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/plans"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 mb-4"
        >
          <ArrowLeft size={16} /> Back to Plans
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{plan.name}</h1>
            <p className="text-sm text-gray-500">
              Version {plan.current_version} · {subscriberCount ?? 0} subscriber{subscriberCount !== 1 ? "s" : ""}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${
            plan.is_active ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-500"
          }`}>
            {plan.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      {/* Editor */}
      <PlanEditor plan={plan} modules={modules || []} />

      {/* Version History */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Version History</h2>

        {(versions && versions.length > 0) ? (
          <div className="space-y-3">
            {versions.map((v: any) => (
              <div
                key={v.id}
                className={`rounded-lg border p-4 ${
                  v.version === plan.current_version
                    ? "border-blue-700 bg-blue-900/20"
                    : "border-gray-800"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">v{v.version}</span>
                    {v.version === plan.current_version && (
                      <span className="rounded bg-blue-600/30 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400 uppercase">
                        Current
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(v.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
                  <div>
                    <span className="text-gray-500">Monthly:</span>{" "}
                    <span className="text-gray-300">${Number(v.price_monthly).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Yearly:</span>{" "}
                    <span className="text-gray-300">
                      {v.price_yearly ? `$${Number(v.price_yearly).toFixed(2)}` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Users:</span>{" "}
                    <span className="text-gray-300">{v.max_users ?? "∞"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Batches:</span>{" "}
                    <span className="text-gray-300">{v.max_batches_per_month ?? "∞"}</span>
                  </div>
                </div>

                {v.included_modules?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {v.included_modules.map((slug: string) => (
                      <span key={slug} className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">
                        {slug}
                      </span>
                    ))}
                  </div>
                )}

                {v.change_notes && (
                  <p className="mt-2 text-xs text-gray-500 italic">
                    {v.change_notes}
                  </p>
                )}

                {v.users?.full_name && (
                  <p className="mt-1 text-[10px] text-gray-600">
                    by {v.users.full_name}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">No version history</p>
        )}
      </div>
    </div>
  );
}
