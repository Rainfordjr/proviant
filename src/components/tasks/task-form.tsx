"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TASK_PRIORITIES, TASK_TYPES } from "@/lib/constants";

interface ChecklistOption {
  id: string;
  name: string;
  description: string | null;
  published_version_id: string | null;
  item_count: number;
}

interface Props {
  orgId: string;
  currentUserId: string;
  departments: { id: string; name: string; color: string }[];
  users: { id: string; full_name: string; email: string }[];
  batches: { id: string; batch_number: string }[];
  recipes: { id: string; name: string }[];
  products: { id: string; name: string; sku: string }[];
  checklists?: ChecklistOption[];
  // For editing existing tasks
  task?: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    task_type: string;
    assigned_to: string | null;
    department_id: string | null;
    batch_id: string | null;
    recipe_id: string | null;
    product_id: string | null;
    due_date: string | null;
    recurrence: string | null;
    checklist_template_id: string | null;
  };
}

export function TaskForm({
  orgId,
  currentUserId,
  departments,
  users,
  batches,
  recipes,
  products,
  checklists = [],
  task,
}: Props) {
  const router = useRouter();
  const isEdit = !!task;

  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [priority, setPriority] = useState(task?.priority || "medium");
  const [taskType, setTaskType] = useState(task?.task_type || "general");
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to || "");
  const [departmentId, setDepartmentId] = useState(task?.department_id || "");
  const [batchId, setBatchId] = useState(task?.batch_id || "");
  const [recipeId, setRecipeId] = useState(task?.recipe_id || "");
  const [productId, setProductId] = useState(task?.product_id || "");
  const [dueDate, setDueDate] = useState(task?.due_date || "");
  const [recurrence, setRecurrence] = useState(task?.recurrence || "");
  const [checklistId, setChecklistId] = useState(task?.checklist_template_id || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedChecklist = checklists.find((c) => c.id === checklistId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setSaving(true);
    setError("");

    const supabase = createClient();

    const checklist = checklists.find((c) => c.id === checklistId);

    const payload = {
      org_id: orgId,
      title: title.trim(),
      description: description.trim() || null,
      priority,
      task_type: taskType,
      assigned_to: assignedTo || null,
      department_id: departmentId || null,
      batch_id: batchId || null,
      recipe_id: recipeId || null,
      product_id: productId || null,
      due_date: dueDate || null,
      recurrence: recurrence || null,
      checklist_template_id: checklistId || null,
      checklist_version_id: checklist?.published_version_id || null,
      ...(isEdit ? {} : { created_by: currentUserId }),
    };

    let result;
    if (isEdit) {
      result = await supabase.from("tasks").update(payload).eq("id", task.id);
    } else {
      result = await supabase.from("tasks").insert(payload).select("id").single();
    }

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    const taskId = isEdit ? task.id : result.data!.id;

    // Copy checklist items from published version onto the task
    if (!isEdit && checklist?.published_version_id) {
      const { data: templateItems } = await supabase
        .from("checklist_template_items")
        .select("id, label, description, sort_order, is_required, answer_type, answer_options, condition_item_id, condition_operator, condition_value")
        .eq("version_id", checklist.published_version_id)
        .order("sort_order");

      if (templateItems && templateItems.length > 0) {
        // First pass: insert items, collecting IDs
        const { data: insertedItems } = await supabase
          .from("task_checklist_items")
          .insert(
            templateItems.map((item: any) => ({
              task_id: taskId,
              label: item.label,
              description: item.description,
              sort_order: item.sort_order,
              is_required: item.is_required,
              answer_type: item.answer_type,
              answer_options: item.answer_options,
              source_template_id: checklist.id,
              source_version_id: checklist.published_version_id,
              source_item_id: item.id,
            }))
          )
          .select("id, source_item_id");

        // Second pass: resolve conditions (template item ID → task item ID)
        if (insertedItems) {
          const templateIdToTaskId: Record<string, string> = {};
          insertedItems.forEach((ti: any) => {
            if (ti.source_item_id) templateIdToTaskId[ti.source_item_id] = ti.id;
          });

          for (const tItem of templateItems) {
            if ((tItem as any).condition_item_id) {
              const taskItemId = templateIdToTaskId[(tItem as any).id];
              const condTaskItemId = templateIdToTaskId[(tItem as any).condition_item_id];
              if (taskItemId && condTaskItemId) {
                await supabase
                  .from("task_checklist_items")
                  .update({
                    condition_item_id: condTaskItemId,
                    condition_operator: (tItem as any).condition_operator,
                    condition_value: (tItem as any).condition_value,
                  })
                  .eq("id", taskItemId);
              }
            }
          }
        }
      }
    }

    router.push(`/tasks/${taskId}`);
    router.refresh();
  }

  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const inputClass =
    "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
        {/* Title */}
        <div>
          <label className={labelClass}>Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Clean mixer #3, Restock flour bin"
            className={inputClass}
          />
        </div>

        {/* Description */}
        <div>
          <label className={labelClass}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional details about what needs to be done…"
            rows={3}
            className={inputClass}
          />
        </div>

        {/* Row: Priority, Type */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelClass}>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass}>
              {Object.entries(TASK_PRIORITIES).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <select value={taskType} onChange={(e) => setTaskType(e.target.value)} className={inputClass}>
              {Object.entries(TASK_TYPES).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Row: Assignee, Department */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Assign To (User)</label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className={inputClass}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Department</label>
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={inputClass}>
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Recurrence */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Recurrence</label>
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className={inputClass}>
              <option value="">One-time</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>
      </div>

      {/* Checklist Template */}
      {checklists.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-700">Attach Checklist</h3>
          </div>
          <select
            value={checklistId}
            onChange={(e) => setChecklistId(e.target.value)}
            className={inputClass}
          >
            <option value="">No checklist</option>
            {checklists.map((c) => (
              <option key={c.id} value={c.id} disabled={!c.published_version_id}>
                {c.name}
                {c.published_version_id ? ` (${c.item_count} items)` : " (no published version)"}
              </option>
            ))}
          </select>
          {selectedChecklist && selectedChecklist.description && (
            <p className="text-xs text-gray-400">{selectedChecklist.description}</p>
          )}
          {selectedChecklist && (
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Check size={12} className="text-green-500" />
              {selectedChecklist.item_count} checklist items will be copied to this task
            </p>
          )}
          {isEdit && (
            <p className="text-xs text-amber-600">
              Note: Changing the checklist on an existing task does not update its checklist items.
            </p>
          )}
        </div>
      )}

      {/* Production Links (collapsible) */}
      <details className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <summary className="cursor-pointer px-6 py-4 text-sm font-semibold text-gray-700">
          Link to Production Entities (Optional)
        </summary>
        <div className="border-t border-gray-200 px-6 py-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Batch</label>
              <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className={inputClass}>
                <option value="">None</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.batch_number}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Recipe</label>
              <select value={recipeId} onChange={(e) => setRecipeId(e.target.value)} className={inputClass}>
                <option value="">None</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Product</label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
                <option value="">None</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </details>

      {/* Error & Submit */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : isEdit ? "Update Task" : "Create Task"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-200 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
