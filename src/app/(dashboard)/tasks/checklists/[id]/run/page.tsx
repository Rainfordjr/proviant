import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ChecklistRun } from "@/components/tasks/checklist-run";

export default async function ChecklistRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("checklists.run");
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("id, org_id")
    .eq("id", user!.id)
    .single();

  // Fetch checklist template
  const { data: template } = await supabase
    .from("checklist_templates")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!template) notFound();

  // Find the approved version
  const { data: version } = await supabase
    .from("checklist_template_versions")
    .select("id, version_number")
    .eq("template_id", id)
    .eq("status", "approved")
    .single();

  if (!version) {
    return (
      <div className="space-y-6">
        <Link href={`/tasks/checklists/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft size={16} /> Back to Checklist
        </Link>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center text-sm text-amber-700">
          No approved version available. A version must be approved before it can be run.
        </div>
      </div>
    );
  }

  // Fetch items for the approved version
  const { data: items } = await supabase
    .from("checklist_template_items")
    .select("*")
    .eq("version_id", version.id)
    .order("sort_order");

  return (
    <div className="space-y-6">
      <Link
        href={`/tasks/checklists/${id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={16} /> Back to Checklist
      </Link>

      <ChecklistRun
        checklistId={id}
        versionId={version.id}
        items={items || []}
        orgId={profile!.org_id}
        currentUserId={profile!.id}
        checklistName={template.name}
        versionNumber={version.version_number}
      />
    </div>
  );
}
