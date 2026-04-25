import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import Link from "next/link";
import { Plus, ClipboardList, ArrowLeft, Palette } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { CHECKLIST_VERSION_STATUSES } from "@/lib/constants";

export default async function ChecklistsPage() {
  await requirePermission("checklists.view");
  const canCreate = await checkPermission("checklists.create");
  const canEdit = await checkPermission("checklists.edit");

  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("checklist_templates")
    .select(`
      *,
      creator:users!checklist_templates_created_by_fkey(id, full_name),
      category:checklist_categories!checklist_templates_category_id_fkey(id, name, color),
      checklist_template_versions(id, version_number, is_published, status, created_at)
    `)
    .order("name");

  // Status counts
  const allTemplates = templates || [];
  const activeCount = allTemplates.filter((t: any) => t.is_active).length;
  const inactiveCount = allTemplates.filter((t: any) => !t.is_active).length;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={16} /> Back to Tasks
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Checklists</h1>
            <p className="text-sm text-gray-500">Reusable checklist templates you can assign to tasks or run standalone</p>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Link
                href="/tasks/checklists/categories"
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Palette size={16} /> Categories
              </Link>
            )}
            {canCreate && (
              <Link
                href="/tasks/checklists/new"
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} /> New Checklist
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{allTemplates.length}</p>
          <p className="text-xs text-gray-500">Total Checklists</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm">
          <p className="text-2xl font-bold text-green-700">{activeCount}</p>
          <p className="text-xs text-green-600">Active</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
          <p className="text-2xl font-bold text-gray-500">{inactiveCount}</p>
          <p className="text-xs text-gray-400">Inactive</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <p className="text-2xl font-bold text-blue-700">
            {allTemplates.filter((t: any) =>
              (t.checklist_template_versions || []).some((v: any) => v.status === "approved")
            ).length}
          </p>
          <p className="text-xs text-blue-600">With Approved Version</p>
        </div>
      </div>

      {allTemplates.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <ClipboardList size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No checklists yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allTemplates.map((t: any) => {
            const versions = t.checklist_template_versions || [];
            const approved = versions.find((v: any) => v.status === "approved");
            const latestVersion = versions.sort(
              (a: any, b: any) => b.version_number - a.version_number
            )[0];
            const displayStatus = approved ? "approved" : latestVersion?.status || "no_version";
            const statusInfo = CHECKLIST_VERSION_STATUSES[displayStatus as keyof typeof CHECKLIST_VERSION_STATUSES];

            return (
              <Link
                key={t.id}
                href={`/tasks/checklists/${t.id}`}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">{t.name}</h3>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!t.is_active && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                        Inactive
                      </span>
                    )}
                    {statusInfo && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    )}
                  </div>
                </div>
                {t.description && (
                  <p className="mt-1 text-xs text-gray-400 line-clamp-2">{t.description}</p>
                )}
                <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                  <span>
                    {versions.length} version{versions.length !== 1 ? "s" : ""}
                  </span>
                  {approved && (
                    <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                      v{approved.version_number} approved
                    </span>
                  )}
                  {t.category && (
                    <span
                      className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ backgroundColor: t.category.color + "20", color: t.category.color }}
                    >
                      {t.category.name}
                    </span>
                  )}
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  Created {formatDate(t.created_at)}
                  {t.creator?.full_name && ` by ${t.creator.full_name}`}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
