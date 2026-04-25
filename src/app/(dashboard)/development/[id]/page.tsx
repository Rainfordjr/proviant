import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import Link from "next/link";
import { ArrowLeft, FlaskConical, Package, FileText, CheckCircle } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { DEV_PROJECT_STATUSES, DEV_NOTE_TYPES, BATCH_STATUSES } from "@/lib/constants";
import { notFound } from "next/navigation";
import { DevBatchNoteForm } from "@/components/development/batch-note-form";
import { DevProjectStatusActions } from "@/components/development/project-status-actions";

export default async function DevProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("development.view");

  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("dev_projects")
    .select("*, recipes(id, name)")
    .eq("id", id)
    .single();

  if (!project) return notFound();

  // Fetch dev batches for this project
  const { data: batches } = await supabase
    .from("batches")
    .select("*, recipe_versions(version_number, recipe_id, recipes(name))")
    .eq("dev_project_id", id)
    .eq("batch_type", "development")
    .order("created_at", { ascending: false });

  // Fetch all notes for these batches
  const batchIds = (batches || []).map((b: any) => b.id);
  let allNotes: any[] = [];
  if (batchIds.length > 0) {
    const { data } = await supabase
      .from("dev_batch_notes")
      .select("*")
      .in("batch_id", batchIds)
      .order("created_at", { ascending: false });
    allNotes = data || [];
  }

  // Group notes by batch
  const notesByBatch: Record<string, any[]> = {};
  allNotes.forEach((note: any) => {
    if (!notesByBatch[note.batch_id]) notesByBatch[note.batch_id] = [];
    notesByBatch[note.batch_id].push(note);
  });

  const statusInfo = DEV_PROJECT_STATUSES[project.status as keyof typeof DEV_PROJECT_STATUSES];

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <Link href="/development" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={16} /> Back to Development
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <FlaskConical size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              {project.recipes?.name && (
                <p className="text-sm text-gray-500">
                  Target: <Link href={`/recipes/${project.recipes.id}`} className="text-blue-600 hover:text-blue-800">{project.recipes.name}</Link>
                </p>
              )}
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusInfo?.color || "bg-gray-100 text-gray-800"}`}>
            {statusInfo?.label || project.status}
          </span>
        </div>
      </div>

      {/* Status actions */}
      {project.status === "active" && (
        <DevProjectStatusActions projectId={id} />
      )}

      {/* Description */}
      {project.description && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Description</h2>
          <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{project.description}</p>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Package size={16} /> <span className="text-xs font-medium uppercase">Test Batches</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{(batches || []).length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <FileText size={16} /> <span className="text-xs font-medium uppercase">Notes Logged</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{allNotes.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <CheckCircle size={16} /> <span className="text-xs font-medium uppercase">Completed Batches</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {(batches || []).filter((b: any) => b.status === "completed").length}
          </p>
        </div>
      </div>

      {/* Test Batches + Notes */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Test Batches & Results</h2>
        <p className="text-sm text-gray-500 mb-4">Development batches and logged observations</p>

        {(batches || []).length === 0 ? (
          <div className="text-sm text-gray-500 py-6 text-center">
            <p>No test batches yet. Create a development batch from the Batches page and link it to this project.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {(batches || []).map((batch: any) => {
              const batchStatus = BATCH_STATUSES[batch.status as keyof typeof BATCH_STATUSES];
              const notes = notesByBatch[batch.id] || [];

              return (
                <div key={batch.id} className="rounded-lg border border-gray-200 p-4">
                  {/* Batch header */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <Link href={`/batches/${batch.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-800">
                        {batch.batch_number}
                      </Link>
                      <span className="text-xs text-gray-400 ml-2">
                        {batch.recipe_versions?.recipes?.name && `${batch.recipe_versions.recipes.name} v${batch.recipe_versions.version_number}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${batchStatus?.color || "bg-gray-100 text-gray-800"}`}>
                        {batchStatus?.label || batch.status}
                      </span>
                      {batch.quantity_produced && (
                        <span className="text-xs text-gray-500">Qty: {batch.quantity_produced}</span>
                      )}
                    </div>
                  </div>

                  {/* Notes for this batch */}
                  {notes.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {notes.map((note: any) => {
                        const noteInfo = DEV_NOTE_TYPES[note.note_type as keyof typeof DEV_NOTE_TYPES];
                        return (
                          <div key={note.id} className="flex gap-3 text-sm">
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${noteInfo?.color || "bg-gray-50 text-gray-700"}`}>
                              {noteInfo?.label || note.note_type}
                            </span>
                            <p className="text-gray-700">{note.content}</p>
                            <span className="shrink-0 text-xs text-gray-400">{formatDate(note.created_at)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add note form */}
                  <DevBatchNoteForm batchId={batch.id} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="text-xs text-gray-400">
        Created {formatDate(project.created_at)} · Last updated {formatDate(project.updated_at)}
      </div>
    </div>
  );
}
