import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Shield, Lock } from "lucide-react";

export default async function RolesPage() {
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

  const { data: roles } = await supabase
    .from("roles")
    .select("*, role_permissions(id)")
    .order("is_admin", { ascending: false })
    .order("is_system", { ascending: false })
    .order("name", { ascending: true });

  // Count users per role
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("role_id");

  const userCountMap: Record<string, number> = {};
  (userRoles || []).forEach((ur: any) => {
    userCountMap[ur.role_id] = (userCountMap[ur.role_id] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
          <p className="text-sm text-gray-500">Create custom roles and control what each role can do</p>
        </div>
        <Link href="/settings/roles/new"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus size={16} /> New Role
        </Link>
      </div>

      <div className="space-y-3">
        {(roles || []).map((role: any) => (
          <Link key={role.id} href={`/settings/roles/${role.id}`}
            className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-200 hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                role.is_admin ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
              }`}>
                {role.is_admin ? <Lock size={20} /> : <Shield size={20} />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-gray-900">{role.name}</h3>
                  {role.is_system && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">System</span>
                  )}
                  {role.is_admin && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">Full Access</span>
                  )}
                </div>
                {role.description && (
                  <p className="text-sm text-gray-500 mt-0.5">{role.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <span>{(role.role_permissions || []).length} permissions</span>
              <span>{userCountMap[role.id] || 0} users</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
