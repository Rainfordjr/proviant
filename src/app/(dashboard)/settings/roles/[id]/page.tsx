import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, Shield } from "lucide-react";
import { notFound } from "next/navigation";
import { PermissionToggles } from "@/components/settings/permission-toggles";

export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data: role } = await supabase
    .from("roles")
    .select("*")
    .eq("id", id)
    .single();

  if (!role) return notFound();

  // Get the user's org_id
  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user!.id)
    .single();

  // Get active module slugs for this org
  const { data: orgModules } = await supabase
    .from("org_modules")
    .select("modules!inner(slug)")
    .eq("org_id", profile!.org_id)
    .eq("is_active", true);

  const activeSlugs = new Set(
    (orgModules || []).map((om: any) => om.modules?.slug).filter(Boolean)
  );

  // Also fetch core module slugs — they're always considered active
  const { data: coreModules } = await supabase
    .from("modules")
    .select("slug")
    .eq("is_core", true);

  const coreSlugs = new Set(
    (coreModules || []).map((m: any) => m.slug).filter(Boolean)
  );

  // Get all permissions
  const { data: allPermissions } = await supabase
    .from("permissions")
    .select("*")
    .order("category")
    .order("code");

  // Filter permissions: show if module_slug is null (global), core, or actively enabled
  const visiblePermissions = (allPermissions || []).filter((p: any) =>
    !p.module_slug || coreSlugs.has(p.module_slug) || activeSlugs.has(p.module_slug)
  );

  // Get this role's granted permissions
  const { data: rolePerms } = await supabase
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", id);

  const grantedIds = new Set((rolePerms || []).map((rp: any) => rp.permission_id));

  // Group permissions by category
  const categories: Record<string, any[]> = {};
  visiblePermissions.forEach((p: any) => {
    if (!categories[p.category]) categories[p.category] = [];
    categories[p.category].push({ ...p, granted: grantedIds.has(p.id) });
  });

  // Get users with this role
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("*, users(id, email, full_name)")
    .eq("role_id", id);

  // Check if this is the only admin role with assigned users
  let isLastAdminRole = false;
  if (role.is_admin) {
    // Count how many admin roles in this org have at least one user assigned
    const { data: adminRoles } = await supabase
      .from("roles")
      .select("id")
      .eq("org_id", role.org_id)
      .eq("is_admin", true);

    if (adminRoles) {
      let adminRolesWithUsers = 0;
      for (const ar of adminRoles) {
        const { count } = await supabase
          .from("user_roles")
          .select("id", { count: "exact", head: true })
          .eq("role_id", ar.id);
        if ((count || 0) > 0) adminRolesWithUsers++;
      }
      isLastAdminRole = adminRolesWithUsers <= 1;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/settings/roles" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={16} /> Back to Roles
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
              role.is_admin ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
            }`}>
              {role.is_admin ? <Lock size={24} /> : <Shield size={24} />}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{role.name}</h1>
              {role.description && <p className="text-sm text-gray-500">{role.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {role.is_system && (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-500">System Role</span>
            )}
            {role.is_admin && (
              <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-600">Full Access</span>
            )}
          </div>
        </div>
      </div>

      {role.is_admin && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">
            This is an admin role with full access to all features. All permissions are automatically granted.
          </p>
        </div>
      )}

      {isLastAdminRole && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            This is the only active administrator role. It cannot be deleted and must always have at least one user assigned.
          </p>
        </div>
      )}

      {/* Permissions */}
      {!role.is_admin && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Permissions</h2>
          <p className="text-sm text-gray-500 mb-6">Toggle which actions this role can perform</p>

          <PermissionToggles roleId={id} categories={categories} mode={role.mode || "whitelist"} isLastAdminRole={isLastAdminRole} />
        </div>
      )}

      {/* Users with this role */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Users with this Role</h2>
        <p className="text-sm text-gray-500 mb-4">
          {(userRoles || []).length} user{(userRoles || []).length !== 1 ? "s" : ""} assigned
        </p>

        {(userRoles || []).length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No users have this role yet.</p>
        ) : (
          <div className="space-y-2">
            {(userRoles || []).map((ur: any) => (
              <div key={ur.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{ur.users?.full_name || "Unknown"}</p>
                  <p className="text-xs text-gray-500">{ur.users?.email}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
