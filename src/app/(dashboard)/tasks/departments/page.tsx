import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DepartmentsManager } from "@/components/tasks/departments-manager";

export default async function DepartmentsPage() {
  await requirePermission("departments.view");
  const canManage = await checkPermission("departments.manage");

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("id, org_id")
    .eq("id", user!.id)
    .single();

  // Fetch departments with member counts
  const { data: departments } = await supabase
    .from("departments")
    .select(`
      *,
      user_departments(
        id,
        is_lead,
        user:users(id, full_name, email)
      )
    `)
    .order("name");

  // Fetch all users for assignment
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, email")
    .order("full_name");

  // Count tasks per department
  const { data: taskCounts } = await supabase
    .from("tasks")
    .select("department_id")
    .not("status", "in", '("done","cancelled")');

  const deptTaskCounts: Record<string, number> = {};
  (taskCounts || []).forEach((t: any) => {
    if (t.department_id) {
      deptTaskCounts[t.department_id] = (deptTaskCounts[t.department_id] || 0) + 1;
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={16} /> Back to Tasks
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
        <p className="text-sm text-gray-500">Manage departments and assign team members</p>
      </div>

      <DepartmentsManager
        departments={departments || []}
        users={users || []}
        taskCounts={deptTaskCounts}
        orgId={profile!.org_id}
        canManage={canManage}
      />
    </div>
  );
}
