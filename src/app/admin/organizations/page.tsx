import { createAdminClient } from "@/lib/platformAdmin";
import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400",
  trial: "bg-blue-500/20 text-blue-400",
  past_due: "bg-amber-500/20 text-amber-400",
  cancelled: "bg-gray-500/20 text-gray-400",
  suspended: "bg-red-500/20 text-red-400",
};

export default async function AdminOrganizationsPage() {
  const supabase = createAdminClient();

  // Get all orgs with their subscription and user count
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  // Get subscriptions for all orgs
  const { data: subscriptions } = await supabase
    .from("org_subscriptions")
    .select("org_id, status, billing_type, custom_rate_monthly, billing_cycle, plans(name, price_monthly)");

  // Get user counts per org
  const { data: userCounts } = await supabase
    .from("users")
    .select("org_id");

  // Build lookup maps
  const subsByOrg: Record<string, any> = {};
  (subscriptions || []).forEach((s: any) => {
    subsByOrg[s.org_id] = s;
  });

  const countByOrg: Record<string, number> = {};
  (userCounts || []).forEach((u: any) => {
    countByOrg[u.org_id] = (countByOrg[u.org_id] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Organizations</h1>
        <p className="text-sm text-gray-500">
          {(orgs || []).length} organization{(orgs || []).length !== 1 ? "s" : ""} on the platform
        </p>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-800">
          <thead>
            <tr className="bg-gray-900">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Users</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Joined</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {(orgs || []).map((org: any) => {
              const sub = subsByOrg[org.id];
              const users = countByOrg[org.id] || 0;
              const status = sub?.status || "none";
              const planName =
                sub?.billing_type === "custom"
                  ? "Custom"
                  : sub?.plans?.name || "—";
              const rate =
                sub?.billing_type === "custom"
                  ? sub?.custom_rate_monthly
                  : sub?.plans?.price_monthly;

              return (
                <tr key={org.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-800 text-xs font-bold text-gray-300">
                        {org.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <span className="text-sm font-medium text-gray-200">{org.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{planName}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[status] || "bg-gray-500/20 text-gray-500"}`}>
                      {status === "none" ? "No Sub" : status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400 text-right">
                    {rate != null ? `$${Number(rate).toFixed(2)}/mo` : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400 text-right">{users}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 text-right">
                    {new Date(org.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/organizations/${org.id}`}
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                    >
                      Manage <ChevronRight size={14} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {(!orgs || orgs.length === 0) && (
          <div className="p-8 text-center text-sm text-gray-500">No organizations found.</div>
        )}
      </div>
    </div>
  );
}
