"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Clock, CheckCircle2, XCircle, AlertCircle, Eye, Send,
  User, Building2, Calendar, Tag, Package, ChefHat, ShoppingBag,
  Trash2, Pencil, ClipboardList, Square, CheckSquare,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TASK_STATUSES, TASK_PRIORITIES, TASK_TYPES } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import { InlineEdit } from "@/components/ui/inline-edit";

interface Comment {
  id: string;
  body: string;
  comment_type: string;
  created_at: string;
  user: { id: string; full_name: string; email: string } | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  task_type: string;
  assigned_to: string | null;
  department_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  recurrence: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  assigned_user: { id: string; full_name: string; email: string } | null;
  department: { id: string; name: string; color: string } | null;
  creator: { id: string; full_name: string } | null;
  batch: { id: string; batch_number: string } | null;
  recipe: { id: string; name: string } | null;
  product: { id: string; name: string; sku: string } | null;
}

interface ChecklistItem {
  id: string;
  label: string;
  description: string | null;
  sort_order: number;
  is_required: boolean;
  is_checked: boolean;
  answer_type: string;
  answer_options: string[] | null;
  answer_value: string | null;
  condition_item_id: string | null;
  condition_operator: string | null;
  condition_value: string | null;
  checked_by: string | null;
  checked_at: string | null;
  checker: { id: string; full_name: string } | null;
}

interface Props {
  task: Task;
  comments: Comment[];
  checklistItems: ChecklistItem[];
  departments: { id: string; name: string; color: string }[];
  users: { id: string; full_name: string; email: string }[];
  currentUserId: string;
  canEdit: boolean;
  canDelete: boolean;
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ["in_progress", "cancelled"],
  in_progress: ["review", "done", "open", "cancelled"],
  review: ["done", "in_progress", "open"],
  done: ["open"],
  cancelled: ["open"],
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  open: AlertCircle,
  in_progress: Clock,
  review: Eye,
  done: CheckCircle2,
  cancelled: XCircle,
};

export function TaskDetail({
  task,
  comments,
  checklistItems,
  departments,
  users,
  currentUserId,
  canEdit,
  canDelete,
}: Props) {
  const router = useRouter();
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const statusInfo = TASK_STATUSES[task.status as keyof typeof TASK_STATUSES];
  const priorityInfo = TASK_PRIORITIES[task.priority as keyof typeof TASK_PRIORITIES];
  const typeInfo = TASK_TYPES[task.task_type as keyof typeof TASK_TYPES];
  const StatusIcon = STATUS_ICONS[task.status] || AlertCircle;
  const transitions = STATUS_TRANSITIONS[task.status] || [];
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !["done", "cancelled"].includes(task.status);

  async function updateField(field: string, value: string | null) {
    const supabase = createClient();
    const update: Record<string, unknown> = { [field]: value || null };
    if (field === "status" && value === "done") {
      update.completed_at = new Date().toISOString();
    }
    if (field === "status" && value !== "done") {
      update.completed_at = null;
    }
    await supabase.from("tasks").update(update).eq("id", task.id);
    // Log status change as a comment
    if (field === "status") {
      const fromLabel = TASK_STATUSES[task.status as keyof typeof TASK_STATUSES]?.label || task.status;
      const toLabel = TASK_STATUSES[value as keyof typeof TASK_STATUSES]?.label || value;
      await supabase.from("task_comments").insert({
        task_id: task.id,
        user_id: currentUserId,
        body: `Status changed from ${fromLabel} to ${toLabel}`,
        comment_type: "status_change",
      });
    }
    router.refresh();
  }

  async function handleTransition(newStatus: string) {
    setTransitioning(true);
    await updateField("status", newStatus);
    setTransitioning(false);
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSending(true);
    const supabase = createClient();
    await supabase.from("task_comments").insert({
      task_id: task.id,
      user_id: currentUserId,
      body: newComment.trim(),
      comment_type: "comment",
    });
    setNewComment("");
    setSending(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this task? This cannot be undone.")) return;
    const supabase = createClient();
    await supabase.from("tasks").delete().eq("id", task.id);
    router.push("/tasks");
    router.refresh();
  }

  async function updateChecklistItem(itemId: string, value: string | null, checked: boolean) {
    const supabase = createClient();
    await supabase
      .from("task_checklist_items")
      .update({
        answer_value: value,
        is_checked: checked,
        checked_by: checked ? currentUserId : null,
        checked_at: checked ? new Date().toISOString() : null,
      })
      .eq("id", itemId);
    router.refresh();
  }

  // Evaluate whether a conditional item should be visible
  function isItemVisible(item: ChecklistItem): boolean {
    if (!item.condition_item_id) return true;
    const source = checklistItems.find((i) => i.id === item.condition_item_id);
    if (!source) return true;
    const sourceVal = source.answer_value || "";
    const condVal = item.condition_value || "";
    switch (item.condition_operator) {
      case "equals":
        return sourceVal === condVal;
      case "not_equals":
        return sourceVal !== condVal;
      case "contains":
        return sourceVal.includes(condVal);
      case "not_empty":
        return sourceVal.trim().length > 0;
      case "gt":
        return Number(sourceVal) > Number(condVal);
      case "lt":
        return Number(sourceVal) < Number(condVal);
      case "gte":
        return Number(sourceVal) >= Number(condVal);
      case "lte":
        return Number(sourceVal) <= Number(condVal);
      default:
        return true;
    }
  }

  const visibleItems = checklistItems.filter(isItemVisible);
  const checkedCount = visibleItems.filter((i) => i.is_checked).length;
  const totalVisibleItems = visibleItems.length;
  const requiredUnchecked = visibleItems.filter((i) => i.is_required && !i.is_checked).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            {canEdit ? (
              <InlineEdit
                value={task.title}
                onSave={(v) => updateField("title", v)}
                label="Title"
                size="lg"
              />
            ) : (
              <h1 className="text-2xl font-bold text-gray-900">{task.title}</h1>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${statusInfo?.color || "bg-gray-100"}`}>
                <StatusIcon size={14} /> {statusInfo?.label || task.status}
              </span>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityInfo?.color || "bg-gray-100"}`}>
                {priorityInfo?.label || task.priority}
              </span>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${typeInfo?.color || "bg-gray-100"}`}>
                {typeInfo?.label || task.task_type}
              </span>
              {isOverdue && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                  Overdue
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <Link
                href={`/tasks/${task.id}/edit`}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
              >
                <Pencil size={14} /> Edit
              </Link>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
        </div>

        {/* Status transitions */}
        {canEdit && transitions.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
            <span className="text-sm text-gray-500">Move to:</span>
            {transitions.map((s) => {
              const info = TASK_STATUSES[s as keyof typeof TASK_STATUSES];
              const Icon = STATUS_ICONS[s];
              return (
                <button
                  key={s}
                  onClick={() => handleTransition(s)}
                  disabled={transitioning}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:shadow-sm disabled:opacity-50 ${
                    s === "done"
                      ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                      : s === "cancelled"
                        ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {Icon && <Icon size={14} />} {info?.label || s}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Description + Comments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Description</h2>
            {canEdit ? (
              <InlineEdit
                value={task.description || ""}
                onSave={(v) => updateField("description", v)}
                label="Description"
                type="textarea"
                placeholder="Add a description…"
                allowEmpty
              />
            ) : (
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {task.description || <span className="text-gray-400 italic">No description</span>}
              </p>
            )}
          </div>

          {/* Checklist */}
          {checklistItems.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <div className="flex items-center gap-2">
                  <ClipboardList size={16} className="text-gray-500" />
                  <h2 className="text-sm font-semibold text-gray-700">Checklist</h2>
                </div>
                <div className="flex items-center gap-3">
                  {requiredUnchecked > 0 && (
                    <span className="text-xs text-amber-600">{requiredUnchecked} required remaining</span>
                  )}
                  <span className="text-xs text-gray-500">
                    {checkedCount}/{totalVisibleItems} complete
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="px-6 pt-3">
                <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      totalVisibleItems > 0 && checkedCount === totalVisibleItems ? "bg-green-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${totalVisibleItems > 0 ? (checkedCount / totalVisibleItems) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="divide-y divide-gray-50 px-2 py-2">
                {checklistItems.map((item) => {
                  const visible = isItemVisible(item);
                  if (!visible) return null;

                  const options: string[] = item.answer_options
                    ? (typeof item.answer_options === "string"
                        ? JSON.parse(item.answer_options as unknown as string)
                        : item.answer_options)
                    : [];

                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 rounded-lg px-4 py-3 transition-colors ${
                        item.condition_item_id ? "ml-4 border-l-2 border-amber-200 " : ""
                      }${item.is_checked ? "bg-gray-50" : "hover:bg-gray-50"}`}
                    >
                      {/* Checkbox column (for checkbox type, also acts as done marker for others) */}
                      {item.answer_type === "checkbox" ? (
                        <button
                          onClick={() =>
                            updateChecklistItem(item.id, item.is_checked ? null : "checked", !item.is_checked)
                          }
                          className={`mt-0.5 shrink-0 transition-colors ${
                            item.is_checked
                              ? "text-green-500 hover:text-green-700"
                              : "text-gray-300 hover:text-blue-500"
                          }`}
                        >
                          {item.is_checked ? <CheckSquare size={20} /> : <Square size={20} />}
                        </button>
                      ) : (
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                            item.is_checked ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {item.is_checked ? "✓" : item.sort_order}
                        </span>
                      )}

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className={`text-sm ${item.is_checked ? "text-gray-400" : "text-gray-700"}`}>
                          {item.label}
                          {item.is_required && !item.is_checked && (
                            <span className="ml-1.5 text-[10px] font-medium text-red-500">Required</span>
                          )}
                        </p>
                        {item.description && (
                          <p className={`text-xs ${item.is_checked ? "text-gray-300" : "text-gray-400"}`}>
                            {item.description}
                          </p>
                        )}

                        {/* Answer input based on type */}
                        {item.answer_type === "yes_no" && (
                          <div className="flex gap-2">
                            {["yes", "no"].map((val) => (
                              <button
                                key={val}
                                onClick={() =>
                                  updateChecklistItem(item.id, val, true)
                                }
                                className={`rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors ${
                                  item.answer_value === val
                                    ? val === "yes"
                                      ? "border-green-300 bg-green-50 text-green-700"
                                      : "border-red-300 bg-red-50 text-red-700"
                                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                                }`}
                              >
                                {val === "yes" ? "Yes" : "No"}
                              </button>
                            ))}
                            {item.answer_value && (
                              <button
                                onClick={() => updateChecklistItem(item.id, null, false)}
                                className="text-xs text-gray-400 hover:text-gray-600"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        )}

                        {item.answer_type === "true_false" && (
                          <div className="flex gap-2">
                            {["true", "false"].map((val) => (
                              <button
                                key={val}
                                onClick={() =>
                                  updateChecklistItem(item.id, val, true)
                                }
                                className={`rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors ${
                                  item.answer_value === val
                                    ? val === "true"
                                      ? "border-green-300 bg-green-50 text-green-700"
                                      : "border-red-300 bg-red-50 text-red-700"
                                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                                }`}
                              >
                                {val === "true" ? "True" : "False"}
                              </button>
                            ))}
                            {item.answer_value && (
                              <button
                                onClick={() => updateChecklistItem(item.id, null, false)}
                                className="text-xs text-gray-400 hover:text-gray-600"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        )}

                        {item.answer_type === "text" && (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              defaultValue={item.answer_value || ""}
                              placeholder="Type your answer…"
                              onBlur={(e) => {
                                const val = e.target.value.trim();
                                updateChecklistItem(item.id, val || null, !!val);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                            />
                          </div>
                        )}

                        {item.answer_type === "select" && options.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {options.map((opt) => (
                              <button
                                key={opt}
                                onClick={() =>
                                  updateChecklistItem(
                                    item.id,
                                    item.answer_value === opt ? null : opt,
                                    item.answer_value !== opt
                                  )
                                }
                                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                                  item.answer_value === opt
                                    ? "border-blue-300 bg-blue-50 text-blue-700"
                                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}

                        {item.answer_type === "number" && (
                          <div className="flex gap-2">
                            <input
                              type="number"
                              defaultValue={item.answer_value || ""}
                              placeholder="Enter number…"
                              onBlur={(e) => {
                                const val = e.target.value.trim();
                                updateChecklistItem(item.id, val || null, !!val);
                              }}
                              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                              className="w-32 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                            />
                          </div>
                        )}

                        {item.answer_type === "temperature" && (() => {
                          const config = (item as any).config || {};
                          return (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.1"
                                defaultValue={item.answer_value || ""}
                                placeholder="Temp"
                                onBlur={(e) => {
                                  const val = e.target.value.trim();
                                  updateChecklistItem(item.id, val || null, !!val);
                                }}
                                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                className="w-24 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                              />
                              <span className="text-sm text-gray-500">°{config.unit || "F"}</span>
                            </div>
                          );
                        })()}

                        {item.answer_type === "datetime" && (
                          <input
                            type="datetime-local"
                            defaultValue={item.answer_value || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateChecklistItem(item.id, val || null, !!val);
                            }}
                            className="w-64 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                          />
                        )}

                        {item.answer_type === "radio" && options.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {options.map((opt) => (
                              <button
                                key={opt}
                                onClick={() =>
                                  updateChecklistItem(
                                    item.id,
                                    item.answer_value === opt ? null : opt,
                                    item.answer_value !== opt
                                  )
                                }
                                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                                  item.answer_value === opt
                                    ? "border-blue-300 bg-blue-50 text-blue-700"
                                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}

                        {item.answer_type === "multi_select" && options.length > 0 && (() => {
                          const selected = item.answer_value ? item.answer_value.split(",") : [];
                          return (
                            <div className="flex flex-wrap gap-2">
                              {options.map((opt) => {
                                const isSelected = selected.includes(opt);
                                return (
                                  <button
                                    key={opt}
                                    onClick={() => {
                                      const next = isSelected
                                        ? selected.filter((s) => s !== opt)
                                        : [...selected, opt];
                                      updateChecklistItem(item.id, next.length > 0 ? next.join(",") : null, next.length > 0);
                                    }}
                                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                                      isSelected
                                        ? "border-blue-300 bg-blue-50 text-blue-700"
                                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                                    }`}
                                  >
                                    {isSelected ? "✓ " : ""}{opt}
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {item.answer_type === "barcode_scan" && (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              defaultValue={item.answer_value || ""}
                              placeholder="Scan or type barcode…"
                              onBlur={(e) => {
                                const val = e.target.value.trim();
                                updateChecklistItem(item.id, val || null, !!val);
                              }}
                              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                              className="w-64 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                            />
                          </div>
                        )}

                        {item.answer_type === "text_match" && (
                          <input
                            type="text"
                            defaultValue={item.answer_value || ""}
                            placeholder="Enter matching text…"
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              updateChecklistItem(item.id, val || null, !!val);
                            }}
                            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                            className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                          />
                        )}

                        {item.answer_type === "employee_list" && (
                          <input
                            type="text"
                            defaultValue={item.answer_value || ""}
                            placeholder="Enter employee name…"
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              updateChecklistItem(item.id, val || null, !!val);
                            }}
                            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                            className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                          />
                        )}

                        {item.answer_type === "photo" && (
                          <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors">
                            {item.answer_value ? `✓ ${item.answer_value}` : "Upload Photo"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) updateChecklistItem(item.id, file.name, true);
                              }}
                            />
                          </label>
                        )}

                        {item.answer_type === "signature" && (
                          <button
                            onClick={() =>
                              updateChecklistItem(
                                item.id,
                                item.answer_value === "signed" ? null : "signed",
                                item.answer_value !== "signed"
                              )
                            }
                            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors ${
                              item.answer_value === "signed"
                                ? "border-green-300 bg-green-50 text-green-700"
                                : "border-gray-200 text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            {item.answer_value === "signed" ? "✓ Signed" : "Sign Here"}
                          </button>
                        )}

                        {item.is_checked && item.checker && (
                          <p className="text-[10px] text-gray-400">
                            Answered by {item.checker.full_name}
                            {item.checked_at && ` at ${formatDateTime(item.checked_at)}`}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Activity / Comments */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-sm font-semibold text-gray-700">Activity</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {comments.length === 0 ? (
                <p className="px-6 py-6 text-sm text-gray-400 text-center">No activity yet</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="px-6 py-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-700">
                        {c.user?.full_name || c.user?.email || "System"}
                      </span>
                      <span className="text-xs text-gray-400">{formatDateTime(c.created_at)}</span>
                      {c.comment_type !== "comment" && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                          {c.comment_type.replace("_", " ")}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${c.comment_type === "comment" ? "text-gray-600" : "text-gray-400 italic"}`}>
                      {c.body}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Add comment */}
            <form onSubmit={handleComment} className="border-t border-gray-200 px-6 py-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a comment…"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || sending}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  <Send size={14} /> Send
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right sidebar: metadata */}
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Details</h2>

            <DetailRow icon={User} label="Assignee">
              {canEdit ? (
                <InlineEdit
                  value={task.assigned_to || ""}
                  onSave={(v) => updateField("assigned_to", v)}
                  label="Assignee"
                  type="select"
                  options={[
                    { value: "", label: "Unassigned" },
                    ...users.map((u) => ({ value: u.id, label: u.full_name || u.email })),
                  ]}
                  renderDisplay={() => (
                    <span className="text-sm text-gray-700">
                      {task.assigned_user?.full_name || "Unassigned"}
                    </span>
                  )}
                />
              ) : (
                <span className="text-sm text-gray-700">{task.assigned_user?.full_name || "Unassigned"}</span>
              )}
            </DetailRow>

            <DetailRow icon={Building2} label="Department">
              {canEdit ? (
                <InlineEdit
                  value={task.department_id || ""}
                  onSave={(v) => updateField("department_id", v)}
                  label="Department"
                  type="select"
                  options={[
                    { value: "", label: "None" },
                    ...departments.map((d) => ({ value: d.id, label: d.name })),
                  ]}
                  renderDisplay={() =>
                    task.department ? (
                      <span
                        className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: task.department.color + "20", color: task.department.color }}
                      >
                        {task.department.name}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">None</span>
                    )
                  }
                />
              ) : (
                task.department ? (
                  <span
                    className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: task.department.color + "20", color: task.department.color }}
                  >
                    {task.department.name}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">None</span>
                )
              )}
            </DetailRow>

            <DetailRow icon={Tag} label="Priority">
              {canEdit ? (
                <InlineEdit
                  value={task.priority}
                  onSave={(v) => updateField("priority", v)}
                  label="Priority"
                  type="select"
                  options={Object.entries(TASK_PRIORITIES).map(([k, v]) => ({ value: k, label: v.label }))}
                  renderDisplay={() => (
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityInfo?.color || "bg-gray-100"}`}>
                      {priorityInfo?.label || task.priority}
                    </span>
                  )}
                />
              ) : (
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityInfo?.color || "bg-gray-100"}`}>
                  {priorityInfo?.label || task.priority}
                </span>
              )}
            </DetailRow>

            <DetailRow icon={Tag} label="Type">
              {canEdit ? (
                <InlineEdit
                  value={task.task_type}
                  onSave={(v) => updateField("task_type", v)}
                  label="Type"
                  type="select"
                  options={Object.entries(TASK_TYPES).map(([k, v]) => ({ value: k, label: v.label }))}
                  renderDisplay={() => (
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${typeInfo?.color || "bg-gray-100"}`}>
                      {typeInfo?.label || task.task_type}
                    </span>
                  )}
                />
              ) : (
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${typeInfo?.color || "bg-gray-100"}`}>
                  {typeInfo?.label || task.task_type}
                </span>
              )}
            </DetailRow>

            <DetailRow icon={Calendar} label="Due Date">
              {task.due_date ? (
                <span className={`text-sm ${isOverdue ? "font-medium text-red-600" : "text-gray-700"}`}>
                  {formatDate(task.due_date)}
                </span>
              ) : (
                <span className="text-sm text-gray-400">No due date</span>
              )}
            </DetailRow>

            {task.recurrence && (
              <DetailRow icon={Clock} label="Recurrence">
                <span className="text-sm text-gray-700 capitalize">{task.recurrence}</span>
              </DetailRow>
            )}

            <div className="border-t border-gray-100 pt-3 space-y-2">
              <p className="text-xs text-gray-400">
                Created by {task.creator?.full_name || "Unknown"} on {formatDate(task.created_at)}
              </p>
              {task.completed_at && (
                <p className="text-xs text-gray-400">
                  Completed on {formatDateTime(task.completed_at)}
                </p>
              )}
            </div>
          </div>

          {/* Linked entities */}
          {(task.batch || task.recipe || task.product) && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-semibold text-gray-700">Linked To</h2>
              {task.batch && (
                <div className="flex items-center gap-2">
                  <Package size={14} className="text-gray-400" />
                  <Link href={`/batches/${task.batch.id}`} className="text-sm text-blue-600 hover:text-blue-800">
                    Batch: {task.batch.batch_number}
                  </Link>
                </div>
              )}
              {task.recipe && (
                <div className="flex items-center gap-2">
                  <ChefHat size={14} className="text-gray-400" />
                  <Link href={`/recipes/${task.recipe.id}`} className="text-sm text-blue-600 hover:text-blue-800">
                    Recipe: {task.recipe.name}
                  </Link>
                </div>
              )}
              {task.product && (
                <div className="flex items-center gap-2">
                  <ShoppingBag size={14} className="text-gray-400" />
                  <Link href={`/products/${task.product.id}`} className="text-sm text-blue-600 hover:text-blue-800">
                    Product: {task.product.name}
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={14} className="shrink-0 text-gray-400" />
      <span className="text-xs font-medium text-gray-500 w-20 shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
