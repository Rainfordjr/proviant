import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import Link from "next/link";
import { Plus } from "lucide-react";
import { TasksList } from "@/components/tasks/tasks-list";

export default async function TasksPage() {
  await requirePermission("tasks.view");
  const canCreate = await checkPermission("tasks.create");

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("id, org_id")
    .eq("id", user!.id)
    .single();

  // Fetch tasks with related data
  const { data: tasks } = await supabase
    .from("tasks")
    .select(`
      *,
      assigned_user:users!tasks_assigned_to_fkey(id, full_name, email),
      department:departments(id, name, color),
      creator:users!tasks_created_by_fkey(id, full_name)
    `)
    .order("created_at", { ascending: false });

  // Fetch departments for filtering
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name, color")
    .eq("is_active", true)
    .order("name");

  // Fetch users for filtering
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, email")
    .order("full_name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500">Manage and track tasks across your team</p>
        </div>
        {canCreate && (
          <Link
            href="/tasks/new"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} /> New Task
          </Link>
        )}
      </div>

      <TasksList
        tasks={tasks || []}
        departments={departments || []}
        users={users || []}
        currentUserId={profile!.id}
      />
    </div>
  );
}
