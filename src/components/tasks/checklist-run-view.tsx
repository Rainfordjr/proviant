"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, AlertCircle, User, Calendar, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";
import { CHECKLIST_ANSWER_TYPES, CHECKLIST_RUN_STATUSES, CHECKLIST_CONDITION_OPERATORS } from "@/lib/constants";

interface TemplateItem {
  id: string;
  label: string;
  description: string | null;
  sort_order: number;
  is_required: boolean;
  answer_type: string;
  answer_options: string[] | null;
  config: Record<string, unknown> | null;
  condition_item_id: string | null;
  condition_operator: string | null;
  condition_value: string | null;
}

interface RunAnswer {
  id: string;
  item_id: string;
  answer_type: string;
  answer_value: string | null;
  answer_meta: Record<string, unknown> | null;
  item_config: Record<string, unknown> | null;
}

interface Run {
  id: string;
  status: string;
  notes: string | null;
  started_at: string;
  completed_at: string | null;
  approved_at: string | null;
  starter: { id: string; full_name: string } | null;
  completer: { id: string; full_name: string } | null;
  approver: { id: string; full_name: string } | null;
  version: { id: string; version_number: number } | null;
}

interface Props {
  run: Run;
  items: TemplateItem[];
  answers: RunAnswer[];
  checklistName: string;
  checklistId: string;
  canApprove: boolean;
  currentUserId: string;
}

export function ChecklistRunView({
  run,
  items,
  answers,
  checklistName,
  checklistId,
  canApprove,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [approving, setApproving] = useState(false);

  const statusInfo = CHECKLIST_RUN_STATUSES[run.status as keyof typeof CHECKLIST_RUN_STATUSES];
  const answeredMap = new Map(answers.map((a) => [a.item_id, a]));

  // Calculate completion
  const answeredCount = answers.length;
  const totalItems = items.length;
  const progress = totalItems > 0 ? (answeredCount / totalItems) * 100 : 0;

  async function handleApprove() {
    setApproving(true);
    const supabase = createClient();
    await supabase
      .from("checklist_runs")
      .update({
        status: "approved",
        approved_by: currentUserId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    setApproving(false);
    router.refresh();
  }

  function formatAnswerDisplay(answer: RunAnswer, item: TemplateItem): string {
    if (!answer.answer_value) return "—";

    const config = (answer.item_config || item.config || {}) as Record<string, string>;

    switch (answer.answer_type) {
      case "yes_no":
        return answer.answer_value === "yes" ? "Yes" : "No";
      case "true_false":
        return answer.answer_value === "true" ? "True" : "False";
      case "checkbox":
        return answer.answer_value === "checked" ? "✓ Done" : "—";
      case "temperature":
        return `${answer.answer_value}°${config.unit || "F"}`;
      case "multi_select":
        return answer.answer_value.split(",").join(", ");
      case "signature":
        return answer.answer_value === "signed" ? "✓ Signed" : "—";
      default:
        return answer.answer_value;
    }
  }

  // Hierarchical numbering
  let mainNumber = 0;
  let subLetterCount = 0;
  const numbering = items.map((item) => {
    if (!item.condition_item_id) {
      mainNumber++;
      subLetterCount = 0;
      return `${mainNumber}`;
    } else {
      subLetterCount++;
      return `${mainNumber}${String.fromCharCode(96 + subLetterCount)}`;
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-gray-900">{checklistName}</h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
              {run.version && <span>Version {run.version.version_number}</span>}
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo?.color || "bg-gray-100"}`}>
                {statusInfo?.label || run.status}
              </span>
            </div>
          </div>
          {canApprove && run.status === "completed" && (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <Check size={14} /> {approving ? "Approving…" : "Approve Run"}
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>{answeredCount} of {totalItems} answered</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progress === 100 ? "bg-green-500" : "bg-blue-500"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Metadata */}
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User size={14} className="text-gray-400" />
            <span>Started by {run.starter?.full_name || "Unknown"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar size={14} className="text-gray-400" />
            <span>Started {formatDateTime(run.started_at)}</span>
          </div>
          {run.completed_at && (
            <>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Check size={14} className="text-gray-400" />
                <span>Completed by {run.completer?.full_name || "Unknown"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock size={14} className="text-gray-400" />
                <span>Completed {formatDateTime(run.completed_at)}</span>
              </div>
            </>
          )}
          {run.approved_at && run.approver && (
            <div className="col-span-2 flex items-center gap-2 text-sm text-green-600">
              <Check size={14} />
              <span>Approved by {run.approver.full_name} on {formatDateTime(run.approved_at)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Answers grid */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-700">Answers</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {items.map((item, idx) => {
            const answer = answeredMap.get(item.id);
            const typeInfo = CHECKLIST_ANSWER_TYPES[item.answer_type as keyof typeof CHECKLIST_ANSWER_TYPES];
            const conditionSource = item.condition_item_id
              ? items.find((i) => i.id === item.condition_item_id)
              : null;
            const condOp = item.condition_operator
              ? CHECKLIST_CONDITION_OPERATORS[item.condition_operator as keyof typeof CHECKLIST_CONDITION_OPERATORS]
              : null;

            return (
              <div
                key={item.id}
                className={`px-6 py-4 ${item.condition_item_id ? "ml-6 border-l-2 border-amber-200" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500">
                    {numbering[idx]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-700">{item.label}</p>
                      {typeInfo && item.answer_type !== "checkbox" && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                          {typeInfo.label}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="mt-0.5 text-xs text-gray-400">{item.description}</p>
                    )}
                    {conditionSource && condOp && (
                      <p className="mt-0.5 text-[10px] text-amber-600">
                        Shown when &quot;{conditionSource.label}&quot; {condOp.label.toLowerCase()}
                        {item.condition_operator !== "not_empty" && item.condition_value ? ` "${item.condition_value}"` : ""}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {answer ? (
                      <span className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium ${
                        item.answer_type === "yes_no" && answer.answer_value === "yes"
                          ? "bg-green-50 text-green-700"
                          : item.answer_type === "yes_no" && answer.answer_value === "no"
                            ? "bg-red-50 text-red-700"
                            : "bg-gray-50 text-gray-700"
                      }`}>
                        {formatAnswerDisplay(answer, item)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">Not answered</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      {run.notes && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={14} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Notes</h2>
          </div>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{run.notes}</p>
        </div>
      )}
    </div>
  );
}
