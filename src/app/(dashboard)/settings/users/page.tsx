import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, UserPlus } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { UserRoleManager } from "@/components/settings/user-role-manager";

export default async function UsersPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: adminCheck } = await supabase
      .from("user_roles")
      .select("roles!inner(is_admin)")
      .eq("user_id", user.id)
      .eq("roles.is_admin", true)
      .limit(1);
    if (!adminCheck || adminCheck.length === 0) {
      redirect("/dashboard?denied=admin");
    }
  }

  // Fetch all users in the org
  const { data: users } = await supabase
    .from("users")
    .select("*")
    .order("full_name", { ascending: true });

  // Fetch all user_roles with role info
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("*, roles(id, name, is_admin)")
    .order("assigned_at", { ascending: false });

  // Group roles by user
  const rolesByUser: Record<string, any[]> = {};
  (userRoles || []).forEach((ur: any) => {
    if (!rolesByUser[ur.user_id]) rolesByUser[ur.user_id] = [];
    rolesByUser[ur.user_id].push(ur);
  });

  // Fetch all roles for the assignment dropdown
  const { data: allRoles } = await supabase
    .from("roles")
    .select("id, name, is_admin")
    .order("name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500">Manage team members and their role assignments</p>
        </div>
        <Link
          href="/settings/users/invite"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <UserPlus size={16} /> Invite User
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Email</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Legacy Role</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Assigned Roles</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(users || []).map((user: any) => {
              const roles = rolesByUser[user.id] || [];
              return (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {user.full_name || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{user.email}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 capitalize">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <UserRoleManager
                      userId={user.id}
                      currentRoles={roles}
                      allRoles={allRoles || []}
                    />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(user.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {(users || []).length === 0 && (
          <div className="p-8 text-center text-sm text-gray-500">No users found.</div>
        )}
      </div>
    </div>
  );
}
