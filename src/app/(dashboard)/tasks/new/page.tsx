import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TaskForm } from "@/components/tasks/task-form";

export default async function NewTaskPage() {
  await requirePermission("tasks.create");

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("id, org_id")
    .eq("id", user!.id)
    .single();

  // Fetch data for dropdowns
  const [{ data: departments }, { data: users }, { data: batches }, { data: recipes }, { data: products }, { data: checklistTemplates }] =
    await Promise.all([
      supabase.from("departments").select("id, name, color").eq("is_active", true).order("name"),
      supabase.from("users").select("id, full_name, email").order("full_name"),
      supabase.from("batches").select("id, batch_number").eq("status", "in_progress").order("batch_number"),
      supabase.from("recipes").select("id, name").order("name"),
      supabase.from("products").select("id, name, sku").order("name"),
      supabase
        .from("checklist_templates")
        .select(`
          id, name, description,
          checklist_template_versions(id, version_number, is_published, checklist_template_items(id))
        `)
        .eq("is_active", true)
        .order("name"),
    ]);

  // Transform checklists into the shape the form expects
  const checklists = (checklistTemplates || []).map((t: any) => {
    const publishedVersion = (t.checklist_template_versions || []).find((v: any) => v.is_published);
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      published_version_id: publishedVersion?.id || null,
      item_count: publishedVersion?.checklist_template_items?.length || 0,
    };
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
        <h1 className="text-2xl font-bold text-gray-900">New Task</h1>
        <p className="text-sm text-gray-500">Create a new task and assign it to a user or department</p>
      </div>

      <TaskForm
        orgId={profile!.org_id}
        currentUserId={profile!.id}
        departments={departments || []}
        users={users || []}
        batches={batches || []}
        recipes={recipes || []}
        products={products || []}
        checklists={checklists}
      />
    </div>
  );
}
