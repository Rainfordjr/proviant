import { createAdminClient } from "@/lib/platformAdmin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OrgSubscriptionManager } from "@/components/admin/org-subscription-manager";
import { OrgLedger } from "@/components/admin/org-ledger";

export default async function AdminOrgDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  // Fetch org
  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .single();

  if (!org) return notFound();

  // Fetch subscription
  const { data: subscription } = await supabase
    .from("org_subscriptions")
    .select("*, plans(*)")
    .eq("org_id", id)
    .maybeSingle();

  // Fetch users in this org
  const { data: users } = await supabase
    .from("users")
    .select("id, email, full_name, role, is_platform_admin, created_at")
    .eq("org_id", id)
    .order("created_at");

  // Fetch all available plans (across all orgs for now, or global ones)
  const { data: plans } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  // Fetch active modules
  const { data: orgModules } = await supabase
    .from("org_modules")
    .select("*, modules(name, slug, is_core)")
    .eq("org_id", id)
    .eq("is_active", true);

  // Fetch invoices
  const { data: invoices } = await supabase
    .from("billing_invoices")
    .select("*")
    .eq("org_id", id)
    .order("period_end", { ascending: false })
    .limit(10);

  // Fetch ledger entries
  const { data: ledgerEntries } = await supabase
    .from("ledger_entries")
    .select("*")
    .eq("org_id", id)
    .order("created_at", { ascending: false });

  // Fetch ledger balance
  const { data: ledgerBalance } = await supabase.rpc("org_ledger_balance", { p_org_id: id });

  // Fetch referral info for this org
  const { data: referral } = await supabase
    .from("referrals")
    .select("*, referrer_org:referrer_org_id(name), referred_org:referred_org_id(name)")
    .or(`referrer_org_id.eq.${id},referred_org_id.eq.${id}`)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/organizations"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 mb-4"
        >
          <ArrowLeft size={16} /> Back to Organizations
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-800 text-lg font-bold text-gray-300">
            {org.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{org.name}</h1>
            <p className="text-sm text-gray-500">
              Created {new Date(org.created_at).toLocaleDateString()} · {(users || []).length} user{(users || []).length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Subscription Manager (client component) */}
      <OrgSubscriptionManager
        orgId={id}
        subscription={subscription}
        plans={plans || []}
      />

      {/* Ledger */}
      <OrgLedger
        orgId={id}
        entries={ledgerEntries || []}
        balance={Number(ledgerBalance || 0)}
        invoices={(invoices || []).map((i: any) => ({
          id: i.id,
          description: i.description,
          amount: i.amount,
          status: i.status,
          period_start: i.period_start,
          period_end: i.period_end,
        }))}
      />

      {/* Referrals */}
      {referral && referral.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Referrals</h2>
          <div className="space-y-2">
            {referral.map((r: any) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-gray-800 p-3"
              >
                <div>
                  <p className="text-sm text-gray-300">
                    {r.referrer_org_id === id ? (
                      <>Referred <span className="font-medium text-purple-400">{(r.referred_org as any)?.name || "Unknown"}</span></>
                    ) : (
                      <>Referred by <span className="font-medium text-purple-400">{(r.referrer_org as any)?.name || "Unknown"}</span></>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    Code: {r.referral_code} · Rate: {(r.credit_rate * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-green-400">
                    ${Number(r.total_credits_earned).toFixed(2)} earned
                  </p>
                  <span className={`text-xs ${
                    r.status === "active" ? "text-green-500" : "text-gray-500"
                  }`}>
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Referral Code */}
      {org.referral_code && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold text-white mb-2">Org Referral Code</h2>
          <p className="text-sm text-gray-400">
            This org&apos;s referral code: <span className="font-mono text-lg text-purple-400">{org.referral_code}</span>
          </p>
        </div>
      )}

      {/* Users */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Users</h2>
        {(users && users.length > 0) ? (
          <div className="space-y-2">
            {users.map((u: any) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-lg border border-gray-800 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-200">{u.full_name || "Unnamed"}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                    {u.role}
                  </span>
                  {u.is_platform_admin && (
                    <span className="rounded-full bg-red-600/20 px-2 py-0.5 text-xs text-red-400">
                      Platform Admin
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">No users</p>
        )}
      </div>

      {/* Active Modules */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Active Modules</h2>
        {(orgModules && orgModules.length > 0) ? (
          <div className="flex flex-wrap gap-2">
            {orgModules.map((om: any) => (
              <span
                key={om.id}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  om.modules?.is_core
                    ? "bg-blue-600/20 text-blue-400"
                    : "bg-green-600/20 text-green-400"
                }`}
              >
                {om.modules?.name || om.modules?.slug}
                {om.modules?.is_core && " (core)"}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">No modules activated</p>
        )}
      </div>

      {/* Invoice History */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Invoice History</h2>
        {(invoices && invoices.length > 0) ? (
          <table className="min-w-full divide-y divide-gray-800">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {invoices.map((inv: any) => (
                <tr key={inv.id}>
                  <td className="px-3 py-2 text-sm text-gray-400">
                    {new Date(inv.period_start).toLocaleDateString()} – {new Date(inv.period_end).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-300 text-right font-medium">
                    ${Number(inv.amount).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      inv.status === "paid" ? "bg-green-500/20 text-green-400" :
                      inv.status === "overdue" ? "bg-red-500/20 text-red-400" :
                      "bg-gray-500/20 text-gray-400"
                    }`}>
                      {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">No invoices</p>
        )}
      </div>
    </div>
  );
}
