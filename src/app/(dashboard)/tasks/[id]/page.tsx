import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TaskDetail } from "@/components/tasks/task-detail";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("tasks.view");
  const canEdit = await checkPermission("tasks.edit");
  const canDelete = await checkPermission("tasks.delete");

  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("id, org_id")
    .eq("id", user!.id)
    .single();

  // Fetch task with relations
  const { data: task } = await supabase
    .from("tasks")
    .select(`
      *,
      assigned_user:users!tasks_assigned_to_fkey(id, full_name, email),
      department:departments(id, name, color),
      creator:users!tasks_created_by_fkey(id, full_name),
      batch:batches(id, batch_number),
      recipe:recipes(id, name),
      product:products(id, name, sku)
    `)
    .eq("id", id)
    .single();

  if (!task) notFound();

  // Fetch comments
  const { data: comments } = await supabase
    .from("task_comments")
    .select(`
      *,
      user:users(id, full_name, email)
    `)
    .eq("task_id", id)
    .order("created_at", { ascending: true });

  // Fetch checklist items
  const { data: checklistItems } = await supabase
    .from("task_checklist_items")
    .select(`
      *,
      checker:users!task_checklist_items_checked_by_fkey(id, full_name)
    `)
    .eq("task_id", id)
    .order("sort_order");

  // Fetch dropdowns for editing
  const [{ data: departments }, { data: users }] = await Promise.all([
    supabase.from("departments").select("id, name, color").eq("is_active", true).order("name"),
    supabase.from("users").select("id, full_name, email").order("full_name"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={16} /> Back to Tasks
        </Link>
      </div>

      <TaskDetail
        task={task}
        comments={comments || []}
        checklistItems={checklistItems || []}
        departments={departments || []}
        users={users || []}
        currentUserId={profile!.id}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>
  );
}
