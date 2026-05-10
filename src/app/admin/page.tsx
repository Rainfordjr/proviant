import { createAdminClient } from "@/lib/platformAdmin";
import { Building2, Users, CreditCard, AlertCircle } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const supabase = createAdminClient();

  // Fetch summary stats
  const [
    { count: orgCount },
    { count: userCount },
    { count: activeSubCount },
    { count: trialCount },
    { count: pastDueCount },
  ] = await Promise.all([
    supabase.from("organizations").select("*", { count: "exact", head: true }),
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("org_subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("org_subscriptions").select("*", { count: "exact", head: true }).eq("status", "trial"),
    supabase.from("org_subscriptions").select("*", { count: "exact", head: true }).eq("status", "past_due"),
  ]);

  // Recent orgs
  const { data: recentOrgs } = await supabase
    .from("organizations")
    .select("id, name, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  const stats = [
    { label: "Organizations", value: orgCount ?? 0, icon: Building2, color: "bg-blue-600/20 text-blue-400", href: "/admin/organizations" },
    { label: "Total Users", value: userCount ?? 0, icon: Users, color: "bg-green-600/20 text-green-400", href: "/admin/users" },
    { label: "Active Subscriptions", value: activeSubCount ?? 0, icon: CreditCard, color: "bg-emerald-600/20 text-emerald-400", href: "/admin/organizations" },
    { label: "Trials", value: trialCount ?? 0, icon: CreditCard, color: "bg-amber-600/20 text-amber-400", href: "/admin/organizations" },
    { label: "Past Due", value: pastDueCount ?? 0, icon: AlertCircle, color: "bg-red-600/20 text-red-400", href: "/admin/organizations" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
        <p className="text-sm text-gray-500">Manage all organizations and subscriptions</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-xl border border-gray-800 bg-gray-900 p-4 hover:border-gray-700 transition-colors"
            >
              <div className={`mb-3 inline-flex items-center justify-center rounded-lg p-2 ${stat.color}`}>
                <Icon size={18} />
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </Link>
          );
        })}
      </div>

      {/* Recent orgs */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Organizations</h2>
          <Link href="/admin/organizations" className="text-sm text-blue-400 hover:text-blue-300">
            View all →
          </Link>
        </div>

        {(recentOrgs && recentOrgs.length > 0) ? (
          <div className="space-y-2">
            {recentOrgs.map((org: any) => (
              <Link
                key={org.id}
                href={`/admin/organizations/${org.id}`}
                className="flex items-center justify-between rounded-lg border border-gray-800 p-3 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-800 text-sm font-bold text-gray-300">
                    {org.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <span className="text-sm font-medium text-gray-200">{org.name}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(org.created_at).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">No organizations yet</p>
        )}
      </div>
    </div>
  );
}
