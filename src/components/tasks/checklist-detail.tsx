"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, Trash2, GripVertical, Check, Clock, AlertCircle,
  Copy, ChevronDown, ChevronRight, Save, Play,
  Send, Archive, Eye, FileText, CornerDownRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatDateTime } from "@/lib/utils";
import { InlineEdit } from "@/components/ui/inline-edit";
import {
  CHECKLIST_ANSWER_TYPES,
  CHECKLIST_CONDITION_OPERATORS,
  CHECKLIST_VERSION_STATUSES,
  CHECKLIST_RUN_STATUSES,
} from "@/lib/constants";

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

interface Version {
  id: string;
  version_number: number;
  notes: string | null;
  is_published: boolean;
  status: string;
  created_by: string | null;
  created_at: string;
  submitted_for_review_by: string | null;
  submitted_for_review_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  archived_by: string | null;
  archived_at: string | null;
  creator: { id: string; full_name: string } | null;
  approver: { id: string; full_name: string } | null;
  checklist_template_items: TemplateItem[];
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

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  category_id: string | null;
  created_at: string;
  creator: { id: string; full_name: string } | null;
  category: Category | null;
}

interface Props {
  template: Template;
  versions: Version[];
  runs: Run[];
  taskCount: number;
  orgId: string;
  currentUserId: string;
  canEdit: boolean;
  canDelete: boolean;
  canRun: boolean;
  canApprove: boolean;
  categories: Category[];
}

interface ItemDraft {
  key: string;
  label: string;
  description: string;
  is_required: boolean;
  answer_type: string;
  answer_options: string[];
  config: Record<string, unknown>;
  condition_source_label: string;
  condition_operator: string;
  condition_value: string;
}

let draftKey = 0;
function nextDraftKey() {
  return `draft-${++draftKey}`;
}

type TabKey = "overview" | "runs" | "versions";

export function ChecklistDetail({
  template,
  versions,
  runs,
  taskCount,
  orgId,
  currentUserId,
  canEdit,
  canDelete,
  canRun,
  canApprove,
  categories,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const approvedVersion = versions.find((v) => v.status === "approved");
  const latestVersion = versions[0]; // sorted by version_number desc
  const displayVersion = approvedVersion || latestVersion;

  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(
    new Set(displayVersion ? [displayVersion.id] : [])
  );
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [newVersionNotes, setNewVersionNotes] = useState("");
  const [newItems, setNewItems] = useState<ItemDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedDraftItem, setExpandedDraftItem] = useState<string | null>(null);

  function toggleVersion(id: string) {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function updateTemplate(field: string, value: string | boolean | null) {
    const supabase = createClient();
    await supabase.from("checklist_templates").update({ [field]: value }).eq("id", template.id);
    router.refresh();
  }

  // Version workflow transitions
  async function transitionVersion(versionId: string, newStatus: string) {
    const supabase = createClient();
    const update: Record<string, unknown> = { status: newStatus };

    if (newStatus === "review") {
      update.submitted_for_review_by = currentUserId;
      update.submitted_for_review_at = new Date().toISOString();
    }
    if (newStatus === "approved") {
      update.approved_by = currentUserId;
      update.approved_at = new Date().toISOString();
      update.is_published = true;
      // Unpublish/archive any other approved version
      const otherApproved = versions.filter((v) => v.id !== versionId && v.status === "approved");
      for (const ov of otherApproved) {
        await supabase
          .from("checklist_template_versions")
          .update({
            status: "archived",
            is_published: false,
            archived_by: currentUserId,
            archived_at: new Date().toISOString(),
          })
          .eq("id", ov.id);
      }
    }
    if (newStatus === "archived") {
      update.archived_by = currentUserId;
      update.archived_at = new Date().toISOString();
      update.is_published = false;
    }

    await supabase.from("checklist_template_versions").update(update).eq("id", versionId);
    router.refresh();
  }

  function itemsToDrafts(sourceItems: TemplateItem[]): ItemDraft[] {
    const drafts: ItemDraft[] = sourceItems.map((item) => {
      const opts: string[] = item.answer_options
        ? (typeof item.answer_options === "string"
            ? JSON.parse(item.answer_options as string)
            : item.answer_options)
        : [];
      return {
        key: nextDraftKey(),
        label: item.label,
        description: item.description || "",
        is_required: item.is_required,
        answer_type: item.answer_type || "checkbox",
        answer_options: opts,
        config: (item.config as Record<string, unknown>) || {},
        condition_source_label: "",
        condition_operator: item.condition_operator || "equals",
        condition_value: item.condition_value || "",
      };
    });
    sourceItems.forEach((item, idx) => {
      if (item.condition_item_id) {
        const sourceItem = sourceItems.find((s) => s.id === item.condition_item_id);
        if (sourceItem) {
          drafts[idx].condition_source_label = sourceItem.label;
        }
      }
    });
    return drafts;
  }

  function startNewVersion() {
    const source = approvedVersion || versions[0];
    if (source) {
      setNewItems(itemsToDrafts(source.checklist_template_items));
    } else {
      setNewItems([{
        key: nextDraftKey(), label: "", description: "", is_required: true,
        answer_type: "checkbox", answer_options: [], config: {},
        condition_source_label: "", condition_operator: "equals", condition_value: "",
      }]);
    }
    setNewVersionNotes("");
    setCreatingVersion(true);
  }

  function addDraftItem() {
    setNewItems((prev) => [
      ...prev,
      {
        key: nextDraftKey(), label: "", description: "", is_required: false,
        answer_type: "checkbox", answer_options: [], config: {},
        condition_source_label: "", condition_operator: "equals", condition_value: "",
      },
    ]);
  }

  function addDraftConditionalChild(parentKey: string) {
    const parent = newItems.find((i) => i.key === parentKey);
    if (!parent || !parent.label.trim()) return;
    const child: ItemDraft = {
      key: nextDraftKey(),
      label: "",
      description: "",
      is_required: false,
      answer_type: "checkbox",
      answer_options: [],
      config: {},
      condition_source_label: parent.label.trim(),
      condition_operator: "equals",
      condition_value:
        parent.answer_type === "yes_no"
          ? "yes"
          : parent.answer_type === "true_false"
          ? "true"
          : parent.answer_type === "checkbox"
          ? "checked"
          : "",
    };
    setNewItems((prev) => {
      const idx = prev.findIndex((i) => i.key === parentKey);
      if (idx === -1) return [...prev, child];
      let insertAt = idx + 1;
      while (
        insertAt < prev.length &&
        prev[insertAt].condition_source_label === parent.label.trim()
      ) {
        insertAt++;
      }
      const next = [...prev];
      next.splice(insertAt, 0, child);
      return next;
    });
    setExpandedDraftItem(child.key);
  }

  function removeDraftItem(key: string) {
    const removed = newItems.find((i) => i.key === key);
    setNewItems((prev) => {
      let filtered = prev.filter((i) => i.key !== key);
      // If removing a parent, clear condition_source_label on any children that pointed to it
      if (removed && removed.label.trim()) {
        filtered = filtered.map((i) =>
          i.condition_source_label === removed.label.trim()
            ? { ...i, condition_source_label: "" }
            : i
        );
      }
      return filtered;
    });
  }

  function getDraftConditionValues(item: ItemDraft): string[] {
    if (item.answer_type === "yes_no") return ["yes", "no"];
    if (item.answer_type === "true_false") return ["true", "false"];
    if (item.answer_type === "checkbox") return ["checked"];
    if (["select", "radio", "multi_select"].includes(item.answer_type))
      return item.answer_options.filter(Boolean);
    return [];
  }

  function updateDraftItem(key: string, field: keyof ItemDraft, value: unknown) {
    setNewItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, [field]: value } : i))
    );
  }

  function moveDraftItem(index: number, direction: -1 | 1) {
    const next = [...newItems];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setNewItems(next);
  }

  async function saveNewVersion(e: React.FormEvent) {
    e.preventDefault();
    const validItems = newItems.filter((i) => i.label.trim());
    if (validItems.length === 0) {
      setError("Add at least one item");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();

    const nextNumber = versions.length > 0 ? Math.max(...versions.map((v) => v.version_number)) + 1 : 1;

    const { data: version, error: vErr } = await supabase
      .from("checklist_template_versions")
      .insert({
        template_id: template.id,
        version_number: nextNumber,
        notes: newVersionNotes.trim() || null,
        is_published: false,
        status: "draft",
        created_by: currentUserId,
      })
      .select("id")
      .single();

    if (vErr || !version) {
      setError(vErr?.message || "Failed to create version");
      setSaving(false);
      return;
    }

    const { data: insertedItems, error: iErr } = await supabase
      .from("checklist_template_items")
      .insert(
        validItems.map((item, idx) => ({
          version_id: version.id,
          label: item.label.trim(),
          description: item.description.trim() || null,
          sort_order: idx + 1,
          is_required: item.is_required,
          answer_type: item.answer_type,
          answer_options:
            ["select", "radio", "multi_select"].includes(item.answer_type) &&
            item.answer_options.filter(Boolean).length > 0
              ? JSON.stringify(item.answer_options.filter(Boolean))
              : null,
          config: Object.keys(item.config).length > 0 ? JSON.stringify(item.config) : null,
        }))
      )
      .select("id");

    if (iErr || !insertedItems) {
      setError(iErr?.message || "Failed to create items");
      setSaving(false);
      return;
    }

    // Second pass: set conditions
    for (let i = 0; i < validItems.length; i++) {
      const draft = validItems[i];
      if (draft.condition_source_label) {
        const sourceIdx = validItems.findIndex(
          (vi, vi_idx) => vi_idx < i && vi.label.trim() === draft.condition_source_label
        );
        if (sourceIdx >= 0 && insertedItems[sourceIdx]) {
          await supabase
            .from("checklist_template_items")
            .update({
              condition_item_id: insertedItems[sourceIdx].id,
              condition_operator: draft.condition_operator,
              condition_value: draft.condition_operator === "not_empty" ? null : draft.condition_value || null,
            })
            .eq("id", insertedItems[i].id);
        }
      }
    }

    setCreatingVersion(false);
    setSaving(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Delete this checklist template? This cannot be undone. Existing tasks will keep their checklist items.")) return;
    const supabase = createClient();
    await supabase.from("checklist_templates").delete().eq("id", template.id);
    router.push("/tasks/checklists");
    router.refresh();
  }

  const inputClass =
    "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300";

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "runs", label: "Runs", count: runs.length },
    { key: "versions", label: "Version History", count: versions.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            {canEdit ? (
              <InlineEdit
                value={template.name}
                onSave={(v) => updateTemplate("name", v)}
                label="Name"
                size="lg"
              />
            ) : (
              <h1 className="text-2xl font-bold text-gray-900">{template.name}</h1>
            )}
            {canEdit ? (
              <InlineEdit
                value={template.description || ""}
                onSave={(v) => updateTemplate("description", v)}
                label="Description"
                placeholder="Add a description…"
                allowEmpty
              />
            ) : (
              template.description && (
                <p className="text-sm text-gray-500">{template.description}</p>
              )
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
              <span>Created {formatDate(template.created_at)}</span>
              {template.creator && <span>by {template.creator.full_name}</span>}
              <span>{versions.length} version{versions.length !== 1 ? "s" : ""}</span>
              <span>{taskCount} task{taskCount !== 1 ? "s" : ""} using this</span>
              {template.category && (
                <span
                  className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: template.category.color + "20", color: template.category.color }}
                >
                  {template.category.name}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canRun && approvedVersion && (
              <Link
                href={`/tasks/checklists/${template.id}/run`}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors flex items-center gap-1.5"
              >
                <Play size={14} /> Run Checklist
              </Link>
            )}
            {canEdit && (
              <>
                <select
                  value={template.category_id || ""}
                  onChange={(e) => updateTemplate("category_id", e.target.value || null)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => updateTemplate("is_active", !template.is_active)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    template.is_active
                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {template.is_active ? "Active" : "Inactive"}
                </button>
              </>
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
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Overview Tab ───────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Active version display */}
          {displayVersion ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold text-gray-700">
                    {approvedVersion ? "Active Version" : "Latest Version"} (v{displayVersion.version_number})
                  </h2>
                  <VersionStatusBadge status={displayVersion.status} />
                </div>
                <span className="text-xs text-gray-400">
                  {displayVersion.checklist_template_items.length} items
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {displayVersion.checklist_template_items.map((item, idx) => (
                  <ItemDisplay key={item.id} item={item} idx={idx} items={displayVersion.checklist_template_items} />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
              No versions yet. Create one to get started.
            </div>
          )}

          {/* New version button */}
          {canEdit && !creatingVersion && (
            <button
              onClick={startNewVersion}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} /> New Version
            </button>
          )}

          {/* New version form */}
          {creatingVersion && (
            <form
              onSubmit={saveNewVersion}
              className="rounded-xl border border-blue-200 bg-blue-50 shadow-sm"
            >
              <div className="border-b border-blue-200 px-6 py-4">
                <h2 className="text-sm font-semibold text-gray-700">
                  New Version (v{versions.length > 0 ? Math.max(...versions.map((v) => v.version_number)) + 1 : 1})
                </h2>
                <p className="text-xs text-gray-500 mt-1">New versions start as Draft. Submit for review, then approve to make active.</p>
                <div className="mt-2">
                  <input
                    type="text"
                    value={newVersionNotes}
                    onChange={(e) => setNewVersionNotes(e.target.value)}
                    placeholder="What changed in this version?"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="divide-y divide-blue-100">
                {newItems.map((item, idx) => {
                  const isConditional = !!item.condition_source_label;
                  const isDraftExpanded = expandedDraftItem === item.key;
                  const priorDraftItems = newItems
                    .slice(0, idx)
                    .filter((i) => i.label.trim());
                  const canHaveFollowUps =
                    item.label.trim() !== "" &&
                    ["yes_no", "true_false", "checkbox", "select", "radio", "multi_select", "number", "text", "text_match"].includes(item.answer_type);
                  return (
                  <div
                    key={item.key}
                    className={`flex items-start gap-3 px-6 py-3 ${
                      isConditional ? "bg-amber-50/30 border-l-4 border-amber-300 pl-10" : ""
                    }`}
                  >
                    <div className="flex flex-col gap-0.5 pt-2">
                      <button type="button" onClick={() => moveDraftItem(idx, -1)} disabled={idx === 0} className="text-gray-300 hover:text-gray-500 disabled:invisible text-xs">▲</button>
                      <GripVertical size={14} className="text-gray-300" />
                      <button type="button" onClick={() => moveDraftItem(idx, 1)} disabled={idx === newItems.length - 1} className="text-gray-300 hover:text-gray-500 disabled:invisible text-xs">▼</button>
                    </div>
                    <span className="mt-2.5 text-sm font-medium text-gray-400 w-6 text-right shrink-0">{idx + 1}.</span>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) => updateDraftItem(item.key, "label", e.target.value)}
                          placeholder="Step label"
                          className={inputClass}
                        />
                        <select
                          value={item.answer_type}
                          onChange={(e) => {
                            updateDraftItem(item.key, "answer_type", e.target.value);
                            if (["select", "radio", "multi_select"].includes(e.target.value)) {
                              updateDraftItem(item.key, "answer_options", item.answer_options.length > 0 ? item.answer_options : [""]);
                            }
                          }}
                          className="w-44 shrink-0 rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-blue-300 focus:outline-none"
                        >
                          {Object.entries(CHECKLIST_ANSWER_TYPES).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateDraftItem(item.key, "description", e.target.value)}
                        placeholder="Description / instructions"
                        className={`${inputClass} text-gray-500`}
                      />
                      {/* Options for select/radio/multi_select */}
                      {["select", "radio", "multi_select"].includes(item.answer_type) && (
                        <div className="ml-4 space-y-1 rounded border border-dashed border-blue-200 p-2">
                          <p className="text-xs font-medium text-gray-500">Options</p>
                          {item.answer_options.map((opt, oi) => (
                            <div key={oi} className="flex gap-2">
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const opts = [...item.answer_options];
                                  opts[oi] = e.target.value;
                                  updateDraftItem(item.key, "answer_options", opts);
                                }}
                                placeholder={`Option ${oi + 1}`}
                                className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm"
                              />
                              <button type="button" onClick={() => {
                                updateDraftItem(item.key, "answer_options", item.answer_options.filter((_, j) => j !== oi));
                              }} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                            </div>
                          ))}
                          <button type="button" onClick={() => {
                            updateDraftItem(item.key, "answer_options", [...item.answer_options, ""]);
                          }} className="text-xs text-blue-600 hover:text-blue-800">+ Add Option</button>
                        </div>
                      )}
                      {/* Config for temperature */}
                      {item.answer_type === "temperature" && (
                        <div className="ml-4 flex items-center gap-2">
                          <span className="text-xs text-gray-500">Unit:</span>
                          <select
                            value={(item.config as Record<string, string>)?.unit || "F"}
                            onChange={(e) => updateDraftItem(item.key, "config", { ...item.config, unit: e.target.value })}
                            className="rounded border border-gray-200 px-2 py-1 text-sm"
                          >
                            <option value="F">°F</option>
                            <option value="C">°C</option>
                          </select>
                        </div>
                      )}
                      {/* Config for number */}
                      {item.answer_type === "number" && (
                        <div className="ml-4 flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">Min:</span>
                            <input
                              type="number"
                              value={(item.config as Record<string, number>)?.min ?? ""}
                              onChange={(e) => updateDraftItem(item.key, "config", { ...item.config, min: e.target.value ? Number(e.target.value) : undefined })}
                              className="w-20 rounded border border-gray-200 px-2 py-1 text-sm"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">Max:</span>
                            <input
                              type="number"
                              value={(item.config as Record<string, number>)?.max ?? ""}
                              onChange={(e) => updateDraftItem(item.key, "config", { ...item.config, max: e.target.value ? Number(e.target.value) : undefined })}
                              className="w-20 rounded border border-gray-200 px-2 py-1 text-sm"
                            />
                          </div>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="inline-flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.is_required}
                            onChange={(e) => updateDraftItem(item.key, "is_required", e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          Required
                        </label>

                        {isConditional && (
                          <button
                            type="button"
                            onClick={() => setExpandedDraftItem(isDraftExpanded ? null : item.key)}
                            className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900"
                          >
                            {isDraftExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            {isDraftExpanded ? "Hide condition" : "Edit condition"}
                          </button>
                        )}

                        {isConditional && (
                          <span className="inline-flex items-center gap-1 text-[10px] rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                            <CornerDownRight size={10} /> Conditional follow-up
                          </span>
                        )}

                        {canHaveFollowUps && (
                          <button
                            type="button"
                            onClick={() => addDraftConditionalChild(item.key)}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 ml-auto"
                          >
                            <CornerDownRight size={12} /> Add conditional follow-up
                          </button>
                        )}
                      </div>

                      {/* Condition editor */}
                      {isDraftExpanded && isConditional && (
                        <div className="rounded-lg border border-amber-300 bg-amber-100/60 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-amber-800">Show this item only when…</p>
                            <button
                              type="button"
                              onClick={() => {
                                updateDraftItem(item.key, "condition_source_label", "");
                                updateDraftItem(item.key, "condition_value", "");
                              }}
                              className="text-[10px] text-amber-700 hover:text-amber-900 underline"
                            >
                              Detach from parent
                            </button>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={item.condition_source_label || ""}
                              onChange={(e) => {
                                updateDraftItem(item.key, "condition_source_label", e.target.value);
                                updateDraftItem(item.key, "condition_value", "");
                              }}
                              className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm"
                            >
                              <option value="">No condition</option>
                              {priorDraftItems.map((pi) => (
                                <option key={pi.key} value={pi.label.trim()}>
                                  Step {newItems.indexOf(pi) + 1}: {pi.label || "(untitled)"}
                                </option>
                              ))}
                            </select>

                            {item.condition_source_label && (
                              <>
                                <select
                                  value={item.condition_operator}
                                  onChange={(e) => updateDraftItem(item.key, "condition_operator", e.target.value)}
                                  className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm"
                                >
                                  {Object.entries(CHECKLIST_CONDITION_OPERATORS).map(([k, v]) => (
                                    <option key={k} value={k}>{v.label}</option>
                                  ))}
                                </select>

                                {!["not_empty"].includes(item.condition_operator) && (() => {
                                  const refItem = newItems.find((i) => i.label.trim() === item.condition_source_label);
                                  const possibleValues = refItem ? getDraftConditionValues(refItem) : [];
                                  if (possibleValues.length > 0) {
                                    return (
                                      <select
                                        value={item.condition_value}
                                        onChange={(e) => updateDraftItem(item.key, "condition_value", e.target.value)}
                                        className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm"
                                      >
                                        <option value="">Select value…</option>
                                        {possibleValues.map((v) => (
                                          <option key={v} value={v}>{v}</option>
                                        ))}
                                      </select>
                                    );
                                  }
                                  return (
                                    <input
                                      type="text"
                                      value={item.condition_value}
                                      onChange={(e) => updateDraftItem(item.key, "condition_value", e.target.value)}
                                      placeholder="Value…"
                                      className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm"
                                    />
                                  );
                                })()}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDraftItem(item.key)}
                      disabled={newItems.length <= 1}
                      className="mt-2.5 text-gray-300 hover:text-red-500 disabled:invisible"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  );
                })}
              </div>

              <div className="border-t border-blue-200 px-6 py-3 flex items-center justify-between">
                <button type="button" onClick={addDraftItem} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800">
                  <Plus size={14} /> Add Item
                </button>
                <div className="flex items-center gap-2">
                  {error && (
                    <span className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle size={12} /> {error}
                    </span>
                  )}
                  <button type="button" onClick={() => setCreatingVersion(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                    <Save size={14} /> {saving ? "Saving…" : "Save Draft"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── Runs Tab ───────────────────────────────────────── */}
      {activeTab === "runs" && (
        <div className="space-y-3">
          {runs.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
              No runs yet. Use the &quot;Run Checklist&quot; button to execute this checklist.
            </div>
          ) : (
            runs.map((run) => {
              const statusInfo = CHECKLIST_RUN_STATUSES[run.status as keyof typeof CHECKLIST_RUN_STATUSES];
              return (
                <Link
                  key={run.id}
                  href={`/tasks/checklists/${template.id}/runs/${run.id}`}
                  className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm hover:border-blue-200 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">
                        Run by {run.starter?.full_name || "Unknown"}
                      </span>
                      {run.version && (
                        <span className="text-xs text-gray-400">v{run.version.version_number}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span>Started {formatDateTime(run.started_at)}</span>
                      {run.completed_at && <span>Completed {formatDateTime(run.completed_at)}</span>}
                      {run.approved_at && <span>Approved by {run.approver?.full_name}</span>}
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo?.color || "bg-gray-100"}`}>
                    {statusInfo?.label || run.status}
                  </span>
                </Link>
              );
            })
          )}
        </div>
      )}

      {/* ── Version History Tab ─────────────────────────────── */}
      {activeTab === "versions" && (
        <div className="space-y-3">
          {versions.map((version) => {
            const isExpanded = expandedVersions.has(version.id);
            const items = version.checklist_template_items;
            const statusInfo = CHECKLIST_VERSION_STATUSES[version.status as keyof typeof CHECKLIST_VERSION_STATUSES];
            const canTransition = canEdit || canApprove;

            // Determine allowed transitions
            const transitions: { status: string; label: string; icon: React.ElementType; color: string }[] = [];
            if (version.status === "draft" && canEdit) {
              transitions.push({ status: "review", label: "Submit for Review", icon: Send, color: "text-amber-600 hover:text-amber-800" });
            }
            if (version.status === "review" && canApprove) {
              transitions.push({ status: "approved", label: "Approve", icon: Check, color: "text-green-600 hover:text-green-800" });
              transitions.push({ status: "draft", label: "Return to Draft", icon: FileText, color: "text-gray-600 hover:text-gray-800" });
            }
            if (version.status === "approved" && canEdit) {
              transitions.push({ status: "archived", label: "Archive", icon: Archive, color: "text-gray-600 hover:text-gray-800" });
            }

            return (
              <div
                key={version.id}
                className={`rounded-xl border bg-white shadow-sm ${statusInfo?.border || "border-gray-200"}`}
              >
                <div
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none"
                  onClick={() => toggleVersion(version.id)}
                >
                  {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-gray-900">Version {version.version_number}</span>
                    {version.notes && <span className="ml-2 text-xs text-gray-400">{version.notes}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <VersionStatusBadge status={version.status} />
                    <span className="text-xs text-gray-400">{items.length} item{items.length !== 1 ? "s" : ""}</span>
                    <span className="text-xs text-gray-400">{formatDate(version.created_at)}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {/* Audit trail */}
                    <div className="px-5 py-3 bg-gray-50 text-xs text-gray-500 space-y-1">
                      <p>Created by {version.creator?.full_name || "Unknown"} on {formatDateTime(version.created_at)}</p>
                      {version.submitted_for_review_at && (
                        <p>Submitted for review {formatDateTime(version.submitted_for_review_at)}</p>
                      )}
                      {version.approved_at && version.approver && (
                        <p>Approved by {version.approver.full_name} on {formatDateTime(version.approved_at)}</p>
                      )}
                      {version.archived_at && (
                        <p>Archived {formatDateTime(version.archived_at)}</p>
                      )}
                    </div>

                    {/* Items */}
                    <div className="divide-y divide-gray-50">
                      {items.map((item, idx) => (
                        <ItemDisplay key={item.id} item={item} idx={idx} items={items} />
                      ))}
                    </div>

                    {/* Actions */}
                    {canTransition && (transitions.length > 0 || canEdit) && (
                      <div className="flex items-center gap-3 border-t border-gray-100 px-5 py-3">
                        {transitions.map((t) => {
                          const TIcon = t.icon;
                          return (
                            <button
                              key={t.status}
                              onClick={() => transitionVersion(version.id, t.status)}
                              className={`inline-flex items-center gap-1 text-xs ${t.color}`}
                            >
                              <TIcon size={12} /> {t.label}
                            </button>
                          );
                        })}
                        {canEdit && (
                          <button
                            onClick={() => {
                              setNewItems(itemsToDrafts(items));
                              setNewVersionNotes("");
                              setCreatingVersion(true);
                              setActiveTab("overview");
                            }}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                          >
                            <Copy size={12} /> Duplicate as new version
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Helper Components ──────────────────────────────────────────

function VersionStatusBadge({ status }: { status: string }) {
  const info = CHECKLIST_VERSION_STATUSES[status as keyof typeof CHECKLIST_VERSION_STATUSES];
  if (!info) return null;
  const icons: Record<string, React.ElementType> = {
    draft: FileText,
    review: Eye,
    approved: Check,
    archived: Archive,
  };
  const Icon = icons[status] || FileText;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${info.color}`}>
      <Icon size={10} /> {info.label}
    </span>
  );
}

function ItemDisplay({
  item,
  idx,
  items,
}: {
  item: {
    id: string;
    label: string;
    description: string | null;
    is_required: boolean;
    answer_type: string;
    answer_options: string[] | null;
    config: Record<string, unknown> | null;
    condition_item_id: string | null;
    condition_operator: string | null;
    condition_value: string | null;
  };
  idx: number;
  items: typeof item[];
}) {
  const typeInfo = CHECKLIST_ANSWER_TYPES[item.answer_type as keyof typeof CHECKLIST_ANSWER_TYPES];
  const conditionSource = item.condition_item_id
    ? items.find((i) => i.id === item.condition_item_id)
    : null;
  const condOp = item.condition_operator
    ? CHECKLIST_CONDITION_OPERATORS[item.condition_operator as keyof typeof CHECKLIST_CONDITION_OPERATORS]
    : null;
  const options: string[] = item.answer_options
    ? (typeof item.answer_options === "string" ? JSON.parse(item.answer_options) : item.answer_options)
    : [];

  return (
    <div className={`flex items-start gap-3 px-5 py-3 ${item.condition_item_id ? "ml-6 border-l-2 border-amber-200" : ""}`}>
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500">
        {idx + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-700">{item.label}</p>
          {item.is_required && <span className="text-[10px] font-medium text-red-500">Required</span>}
          {typeInfo && item.answer_type !== "checkbox" && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
              {typeInfo.label}
            </span>
          )}
        </div>
        {item.description && <p className="mt-0.5 text-xs text-gray-400">{item.description}</p>}
        {options.length > 0 && <p className="mt-0.5 text-xs text-gray-400">Options: {options.join(", ")}</p>}
        {item.config && item.answer_type === "temperature" && (
          <p className="mt-0.5 text-xs text-gray-400">Unit: °{(item.config as Record<string, string>).unit || "F"}</p>
        )}
        {conditionSource && condOp && (
          <p className="mt-1 text-[10px] text-amber-600">
            Shown when &quot;{conditionSource.label}&quot; {condOp.label.toLowerCase()}
            {item.condition_operator !== "not_empty" && item.condition_value ? ` "${item.condition_value}"` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
