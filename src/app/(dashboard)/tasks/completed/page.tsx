import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import Link from "next/link";
import { ArrowLeft, Check, Clock } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { TASK_PRIORITIES, TASK_COMPLETION_STATUSES } from "@/lib/constants";

export default async function CompletedTasksPage() {
  await requirePermission("tasks.view");
  const canApprove = await checkPermission("tasks.approve");
  const supabase = await createClient();

  const { data: completions } = await supabase
    .from("task_completions")
    .select(`
      *,
      completer:users!task_completions_completed_by_fkey(id, full_name),
      approver:users!task_completions_approved_by_fkey(id, full_name),
      task:tasks!task_completions_task_id_fkey(id, title, priority, task_type)
    `)
    .order("completed_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={16} /> Back to Tasks
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Completed Tasks</h1>
        <p className="text-sm text-gray-500 mt-1">
          {completions?.length || 0} completion record{(completions?.length || 0) !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {(!completions || completions.length === 0) ? (
          <p className="px-6 py-8 text-center text-sm text-gray-400">No completed tasks yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {completions.map((c: any) => {
              const statusInfo = TASK_COMPLETION_STATUSES[c.status as keyof typeof TASK_COMPLETION_STATUSES];
              const priorityInfo = c.task?.priority
                ? TASK_PRIORITIES[c.task.priority as keyof typeof TASK_PRIORITIES]
                : null;

              return (
                <div key={c.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {c.task && (
                        <Link
                          href={`/tasks/${c.task.id}`}
                          className="text-sm font-medium text-gray-700 hover:text-blue-600 truncate"
                        >
                          {c.task.title}
                        </Link>
                      )}
                      {priorityInfo && (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityInfo.color}`}>
                          {priorityInfo.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span>Completed by {c.completer?.full_name || "Unknown"}</span>
                      <span>{formatDateTime(c.completed_at)}</span>
                      {c.notes && <span className="truncate max-w-xs">Note: {c.notes}</span>}
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo?.color || "bg-gray-100"}`}>
                    {statusInfo?.label || c.status}
                  </span>
                  {canApprove && c.status === "pending" && (
                    <ApproveButton completionId={c.id} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Client component for the approve button
function ApproveButton({ completionId }: { completionId: string }) {
  return (
    <form action={`/api/tasks/approve-completion`} method="POST">
      <input type="hidden" name="completionId" value={completionId} />
      <button
        type="submit"
        className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
      >
        <Check size={12} /> Approve
      </button>
    </form>
  );
}
