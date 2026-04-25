import { createAdminClient } from "@/lib/platformAdmin";
import Link from "next/link";

export default async function AdminUsersPage() {
  const supabase = createAdminClient();

  const { data: users } = await supabase
    .from("users")
    .select("id, email, full_name, role, org_id, is_platform_admin, created_at, organizations(name)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">All Users</h1>
        <p className="text-sm text-gray-500">
          {(users || []).length} user{(users || []).length !== 1 ? "s" : ""} across all organizations
        </p>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-800">
          <thead>
            <tr className="bg-gray-900">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Flags</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {(users || []).map((u: any) => (
              <tr key={u.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-200">{u.full_name || "Unnamed"}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/organizations/${u.org_id}`}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    {u.organizations?.name || "Unknown"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {u.is_platform_admin && (
                    <span className="rounded-full bg-red-600/20 px-2 py-0.5 text-xs text-red-400">
                      Platform Admin
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 text-right">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {(!users || users.length === 0) && (
          <div className="p-8 text-center text-sm text-gray-500">No users found.</div>
        )}
      </div>
    </div>
  );
}
