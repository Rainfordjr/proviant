import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import Link from "next/link";
import { Plus, FlaskConical } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { DEV_PROJECT_STATUSES } from "@/lib/constants";

export default async function DevProjectsPage() {
  await requirePermission("development.view");
  const canCreate = await checkPermission("development.create");

  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("dev_projects")
    .select("*, recipes(name)")
    .order("created_at", { ascending: false });

  // Count dev batches per project
  const { data: devBatches } = await supabase
    .from("batches")
    .select("dev_project_id")
    .eq("batch_type", "development")
    .not("dev_project_id", "is", null);

  const batchCountMap: Record<string, number> = {};
  (devBatches || []).forEach((b: any) => {
    if (b.dev_project_id) {
      batchCountMap[b.dev_project_id] = (batchCountMap[b.dev_project_id] || 0) + 1;
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Development</h1>
          <p className="text-sm text-gray-500">R&D projects for testing new recipes and formulations</p>
        </div>
        {canCreate && (
          <Link href="/development/new"
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">
            <Plus size={16} /> New Project
          </Link>
        )}
      </div>

      {(projects || []).length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <FlaskConical size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-900">No R&D projects yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Start a development project to test new recipes with trial batches before going to production.
          </p>
          {canCreate && (
            <Link href="/development/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">
              <Plus size={16} /> New Project
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {(projects || []).map((project: any) => {
            const statusInfo = DEV_PROJECT_STATUSES[project.status as keyof typeof DEV_PROJECT_STATUSES];
            return (
              <Link key={project.id} href={`/development/${project.id}`}
                className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-purple-200 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                      <FlaskConical size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{project.name}</h3>
                      {project.recipes?.name && (
                        <p className="text-xs text-gray-500">Target recipe: {project.recipes.name}</p>
                      )}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo?.color || "bg-gray-100 text-gray-800"}`}>
                    {statusInfo?.label || project.status}
                  </span>
                </div>
                {project.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2 ml-13">{project.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
                  <span>{batchCountMap[project.id] || 0} test batches</span>
                  <span>Created {formatDate(project.created_at)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
