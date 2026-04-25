import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ChecklistRunView } from "@/components/tasks/checklist-run-view";

export default async function ChecklistRunViewPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  await requirePermission("checklists.view");
  const canApprove = await checkPermission("checklists.approve");
  const { id, runId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Fetch checklist name
  const { data: template } = await supabase
    .from("checklist_templates")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!template) notFound();

  // Fetch run with relations
  const { data: run } = await supabase
    .from("checklist_runs")
    .select(`
      *,
      starter:users!checklist_runs_started_by_fkey(id, full_name),
      completer:users!checklist_runs_completed_by_fkey(id, full_name),
      approver:users!checklist_runs_approved_by_fkey(id, full_name),
      version:checklist_template_versions!checklist_runs_version_id_fkey(id, version_number)
    `)
    .eq("id", runId)
    .single();

  if (!run) notFound();

  // Fetch version items
  const { data: items } = await supabase
    .from("checklist_template_items")
    .select("*")
    .eq("version_id", run.version_id)
    .order("sort_order");

  // Fetch answers for this run
  const { data: answers } = await supabase
    .from("checklist_run_answers")
    .select("*")
    .eq("run_id", runId);

  return (
    <div className="space-y-6">
      <Link
        href={`/tasks/checklists/${id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={16} /> Back to Checklist
      </Link>

      <ChecklistRunView
        run={run}
        items={items || []}
        answers={answers || []}
        checklistName={template.name}
        checklistId={id}
        canApprove={canApprove}
        currentUserId={user!.id}
      />
    </div>
  );
}
