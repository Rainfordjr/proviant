import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ChecklistDetail } from "@/components/tasks/checklist-detail";

export default async function ChecklistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("checklists.view");
  const canEdit = await checkPermission("checklists.edit");
  const canDelete = await checkPermission("checklists.delete");
  const canRun = await checkPermission("checklists.run");
  const canApprove = await checkPermission("checklists.approve");

  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("id, org_id")
    .eq("id", user!.id)
    .single();

  // Fetch template with category
  const { data: template } = await supabase
    .from("checklist_templates")
    .select(`
      *,
      creator:users!checklist_templates_created_by_fkey(id, full_name),
      category:checklist_categories!checklist_templates_category_id_fkey(id, name, color)
    `)
    .eq("id", id)
    .single();

  if (!template) notFound();

  // Fetch versions with items, creator, and approver
  const { data: versions } = await supabase
    .from("checklist_template_versions")
    .select(`
      *,
      creator:users!checklist_template_versions_created_by_fkey(id, full_name),
      approver:users!checklist_template_versions_approved_by_fkey(id, full_name),
      checklist_template_items(id, label, description, sort_order, is_required, answer_type, answer_options, config, condition_item_id, condition_operator, condition_value)
    `)
    .eq("template_id", id)
    .order("version_number", { ascending: false });

  // Fetch runs for this checklist
  const { data: runs } = await supabase
    .from("checklist_runs")
    .select(`
      *,
      starter:users!checklist_runs_started_by_fkey(id, full_name),
      completer:users!checklist_runs_completed_by_fkey(id, full_name),
      approver:users!checklist_runs_approved_by_fkey(id, full_name),
      version:checklist_template_versions!checklist_runs_version_id_fkey(id, version_number)
    `)
    .eq("checklist_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Count tasks using this template
  const { count: taskCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("checklist_template_id", id);

  // Fetch categories for the category selector
  const { data: categories } = await supabase
    .from("checklist_categories")
    .select("id, name, color")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/tasks/checklists"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={16} /> Back to Checklists
        </Link>
      </div>

      <ChecklistDetail
        template={template}
        versions={(versions || []).map((v: any) => ({
          ...v,
          checklist_template_items: (v.checklist_template_items || []).sort(
            (a: any, b: any) => a.sort_order - b.sort_order
          ),
        }))}
        runs={runs || []}
        taskCount={taskCount || 0}
        orgId={profile!.org_id}
        currentUserId={profile!.id}
        canEdit={canEdit}
        canDelete={canDelete}
        canRun={canRun}
        canApprove={canApprove}
        categories={categories || []}
      />
    </div>
  );
}
