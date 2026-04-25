"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, GripVertical, AlertCircle, ChevronDown, ChevronRight, CornerDownRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CHECKLIST_ANSWER_TYPES, CHECKLIST_CONDITION_OPERATORS } from "@/lib/constants";

interface ItemDraft {
  key: string;
  label: string;
  description: string;
  is_required: boolean;
  answer_type: string;
  answer_options: string[];
  config: Record<string, unknown>;
  condition_key: string | null;
  condition_operator: string;
  condition_value: string;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Props {
  orgId: string;
  currentUserId: string;
  categories?: Category[];
}

let itemKeyCounter = 0;
function nextKey() {
  return `item-${++itemKeyCounter}`;
}

function blankItem(): ItemDraft {
  return {
    key: nextKey(),
    label: "",
    description: "",
    is_required: false,
    answer_type: "checkbox",
    answer_options: [],
    config: {},
    condition_key: null,
    condition_operator: "equals",
    condition_value: "",
  };
}

// Types that use custom options
const OPTION_TYPES = ["select", "radio", "multi_select"];

export function ChecklistForm({ orgId, currentUserId, categories = [] }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [versionNotes, setVersionNotes] = useState("Initial version");
  const [items, setItems] = useState<ItemDraft[]>([{ ...blankItem(), is_required: true }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  function addItem() {
    setItems((prev) => [...prev, blankItem()]);
  }

  function addConditionalChild(parentKey: string) {
    const parent = items.find((i) => i.key === parentKey);
    if (!parent) return;
    const child: ItemDraft = {
      ...blankItem(),
      condition_key: parentKey,
      condition_operator: "equals",
      // Pre-fill a sensible default value for yes_no / true_false / checkbox
      condition_value:
        parent.answer_type === "yes_no"
          ? "yes"
          : parent.answer_type === "true_false"
          ? "true"
          : parent.answer_type === "checkbox"
          ? "checked"
          : "",
    };
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.key === parentKey);
      if (idx === -1) return [...prev, child];
      // Insert right after the parent (and after any existing children already attached to this parent)
      let insertAt = idx + 1;
      while (insertAt < prev.length && prev[insertAt].condition_key === parentKey) {
        insertAt++;
      }
      const next = [...prev];
      next.splice(insertAt, 0, child);
      return next;
    });
    setExpandedItem(child.key);
  }

  function removeItem(key: string) {
    setItems((prev) => {
      return prev
        .filter((i) => i.key !== key)
        .map((i) => (i.condition_key === key ? { ...i, condition_key: null } : i));
    });
  }

  function updateItem(key: string, updates: Partial<ItemDraft>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...updates } : i)));
  }

  function moveItem(index: number, direction: -1 | 1) {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  }

  function addOption(key: string) {
    setItems((prev) =>
      prev.map((i) =>
        i.key === key ? { ...i, answer_options: [...i.answer_options, ""] } : i
      )
    );
  }

  function updateOption(key: string, idx: number, value: string) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.key !== key) return i;
        const opts = [...i.answer_options];
        opts[idx] = value;
        return { ...i, answer_options: opts };
      })
    );
  }

  function removeOption(key: string, idx: number) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.key !== key) return i;
        return { ...i, answer_options: i.answer_options.filter((_, j) => j !== idx) };
      })
    );
  }

  function getConditionValues(item: ItemDraft): string[] {
    if (item.answer_type === "yes_no") return ["yes", "no"];
    if (item.answer_type === "true_false") return ["true", "false"];
    if (item.answer_type === "checkbox") return ["checked"];
    if (OPTION_TYPES.includes(item.answer_type)) return item.answer_options.filter(Boolean);
    return [];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    const validItems = items.filter((i) => i.label.trim());
    if (validItems.length === 0) {
      setError("Add at least one checklist item");
      return;
    }

    setSaving(true);
    setError("");
    const supabase = createClient();

    // 1. Create template
    const { data: template, error: tErr } = await supabase
      .from("checklist_templates")
      .insert({
        org_id: orgId,
        name: name.trim(),
        description: description.trim() || null,
        category_id: categoryId || null,
        created_by: currentUserId,
      })
      .select("id")
      .single();

    if (tErr || !template) {
      setError(tErr?.message || "Failed to create checklist");
      setSaving(false);
      return;
    }

    // 2. Create version 1 as draft
    const { data: version, error: vErr } = await supabase
      .from("checklist_template_versions")
      .insert({
        template_id: template.id,
        version_number: 1,
        notes: versionNotes.trim() || null,
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

    // 3. Insert items (first pass)
    const itemPayloads = validItems.map((item, idx) => ({
      version_id: version.id,
      label: item.label.trim(),
      description: item.description.trim() || null,
      sort_order: idx + 1,
      is_required: item.is_required,
      answer_type: item.answer_type,
      answer_options:
        OPTION_TYPES.includes(item.answer_type) && item.answer_options.filter(Boolean).length > 0
          ? JSON.stringify(item.answer_options.filter(Boolean))
          : null,
      config: Object.keys(item.config).length > 0 ? JSON.stringify(item.config) : null,
    }));

    const { data: insertedItems, error: iErr } = await supabase
      .from("checklist_template_items")
      .insert(itemPayloads)
      .select("id");

    if (iErr || !insertedItems) {
      setError(iErr?.message || "Failed to create items");
      setSaving(false);
      return;
    }

    // 4. Second pass — set conditions
    const keyToId: Record<string, string> = {};
    validItems.forEach((item, idx) => {
      keyToId[item.key] = insertedItems[idx].id;
    });

    for (const item of validItems) {
      if (item.condition_key && keyToId[item.condition_key]) {
        const dbId = keyToId[item.key];
        await supabase
          .from("checklist_template_items")
          .update({
            condition_item_id: keyToId[item.condition_key],
            condition_operator: item.condition_operator,
            condition_value: item.condition_operator === "not_empty" ? null : item.condition_value || null,
          })
          .eq("id", dbId);
      }
    }

    router.push(`/tasks/checklists/${template.id}`);
    router.refresh();
  }

  const inputClass =
    "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Template info */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Checklist Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Pre-Clean Checklist, End of Shift Sanitation"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this checklist used for?"
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputClass}
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Version Notes</label>
            <input
              type="text"
              value={versionNotes}
              onChange={(e) => setVersionNotes(e.target.value)}
              placeholder="e.g., Initial version"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-700">Checklist Items</h2>
          <span className="text-xs text-gray-400">{items.filter((i) => i.label.trim()).length} items</span>
        </div>

        <div className="divide-y divide-gray-100">
          {items.map((item, idx) => {
            const isExpanded = expandedItem === item.key;
            const priorItems = items.slice(0, idx).filter((i) => i.label.trim());
            const isConditional = !!item.condition_key;
            // Check if this item can have conditional follow-ups (based on its answer_type)
            const canHaveFollowUps =
              item.label.trim() !== "" &&
              ["yes_no", "true_false", "checkbox", "select", "radio", "multi_select", "number", "text", "text_match"].includes(item.answer_type);

            return (
              <div
                key={item.key}
                className={`px-6 py-4 ${isConditional ? "bg-amber-50/30 border-l-4 border-amber-300 pl-10" : ""}`}
              >
                <div className="flex items-start gap-3">
                  {/* Reorder */}
                  <div className="flex flex-col gap-0.5 pt-2">
                    <button type="button" onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="text-gray-300 hover:text-gray-500 disabled:invisible text-xs">▲</button>
                    <GripVertical size={14} className="text-gray-300" />
                    <button type="button" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} className="text-gray-300 hover:text-gray-500 disabled:invisible text-xs">▼</button>
                  </div>

                  <span className="mt-2.5 text-sm font-medium text-gray-400 w-6 text-right shrink-0">
                    {idx + 1}.
                  </span>

                  {/* Main fields */}
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => updateItem(item.key, { label: e.target.value })}
                        placeholder="Step label (required)"
                        className={inputClass}
                      />
                      <select
                        value={item.answer_type}
                        onChange={(e) => {
                          const newType = e.target.value;
                          updateItem(item.key, {
                            answer_type: newType,
                            answer_options: OPTION_TYPES.includes(newType) ? (item.answer_options.length > 0 ? item.answer_options : [""]) : [],
                            config: newType === "temperature" ? { unit: "F" } : {},
                          });
                        }}
                        className="w-44 shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none"
                      >
                        {Object.entries(CHECKLIST_ANSWER_TYPES).map(([key, val]) => (
                          <option key={key} value={key}>
                            {val.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.key, { description: e.target.value })}
                      placeholder="Optional description or instructions"
                      className={`${inputClass} text-gray-500`}
                    />

                    {/* Options for select/radio/multi_select */}
                    {OPTION_TYPES.includes(item.answer_type) && (
                      <div className="ml-4 space-y-1.5 rounded-lg border border-dashed border-gray-200 p-3">
                        <p className="text-xs font-medium text-gray-500">Custom Options</p>
                        {item.answer_options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => updateOption(item.key, oi, e.target.value)}
                              placeholder={`Option ${oi + 1}`}
                              className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-300 focus:outline-none"
                            />
                            <button type="button" onClick={() => removeOption(item.key, oi)} className="text-gray-300 hover:text-red-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                        <button type="button" onClick={() => addOption(item.key)} className="text-xs text-blue-600 hover:text-blue-800">
                          + Add Option
                        </button>
                      </div>
                    )}

                    {/* Config: temperature unit */}
                    {item.answer_type === "temperature" && (
                      <div className="ml-4 flex items-center gap-2">
                        <span className="text-xs text-gray-500">Unit:</span>
                        <select
                          value={(item.config as Record<string, string>)?.unit || "F"}
                          onChange={(e) => updateItem(item.key, { config: { ...item.config, unit: e.target.value } })}
                          className="rounded border border-gray-200 px-2 py-1 text-sm"
                        >
                          <option value="F">°F</option>
                          <option value="C">°C</option>
                        </select>
                      </div>
                    )}

                    {/* Config: number min/max */}
                    {item.answer_type === "number" && (
                      <div className="ml-4 flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">Min:</span>
                          <input
                            type="number"
                            value={(item.config as Record<string, number>)?.min ?? ""}
                            onChange={(e) => updateItem(item.key, { config: { ...item.config, min: e.target.value ? Number(e.target.value) : undefined } })}
                            className="w-20 rounded border border-gray-200 px-2 py-1 text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">Max:</span>
                          <input
                            type="number"
                            value={(item.config as Record<string, number>)?.max ?? ""}
                            onChange={(e) => updateItem(item.key, { config: { ...item.config, max: e.target.value ? Number(e.target.value) : undefined } })}
                            className="w-20 rounded border border-gray-200 px-2 py-1 text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {/* Bottom row: required + expand for conditions + add conditional follow-up */}
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="inline-flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.is_required}
                          onChange={(e) => updateItem(item.key, { is_required: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        Required
                      </label>

                      {/* Only show "Add condition" for items that already have a condition OR no prior items for inline add */}
                      {isConditional && (
                        <button
                          type="button"
                          onClick={() => setExpandedItem(isExpanded ? null : item.key)}
                          className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900"
                        >
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          {isExpanded ? "Hide condition" : "Edit condition"}
                        </button>
                      )}

                      {isConditional && (
                        <span className="inline-flex items-center gap-1 text-[10px] rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                          <CornerDownRight size={10} /> Conditional follow-up
                        </span>
                      )}

                      {/* Inline "Add conditional follow-up" — initiates a child question from inside this one */}
                      {canHaveFollowUps && (
                        <button
                          type="button"
                          onClick={() => addConditionalChild(item.key)}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 ml-auto"
                        >
                          <CornerDownRight size={12} /> Add conditional follow-up
                        </button>
                      )}
                    </div>

                    {/* Condition editor — shown when item is conditional and expanded */}
                    {isExpanded && isConditional && (
                      <div className="rounded-lg border border-amber-300 bg-amber-100/60 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-amber-800">Show this item only when…</p>
                          <button
                            type="button"
                            onClick={() =>
                              updateItem(item.key, {
                                condition_key: null,
                                condition_value: "",
                              })
                            }
                            className="text-[10px] text-amber-700 hover:text-amber-900 underline"
                          >
                            Detach from parent
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={item.condition_key || ""}
                            onChange={(e) =>
                              updateItem(item.key, {
                                condition_key: e.target.value || null,
                                condition_value: "",
                              })
                            }
                            className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm"
                          >
                            <option value="">No condition</option>
                            {priorItems.map((pi) => (
                              <option key={pi.key} value={pi.key}>
                                Step {items.indexOf(pi) + 1}: {pi.label || "(untitled)"}
                              </option>
                            ))}
                          </select>

                          {item.condition_key && (
                            <>
                              <select
                                value={item.condition_operator}
                                onChange={(e) =>
                                  updateItem(item.key, { condition_operator: e.target.value })
                                }
                                className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm"
                              >
                                {Object.entries(CHECKLIST_CONDITION_OPERATORS).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v.label}
                                  </option>
                                ))}
                              </select>

                              {!["not_empty"].includes(item.condition_operator) && (() => {
                                const refItem = items.find((i) => i.key === item.condition_key);
                                const possibleValues = refItem ? getConditionValues(refItem) : [];
                                if (possibleValues.length > 0) {
                                  return (
                                    <select
                                      value={item.condition_value}
                                      onChange={(e) =>
                                        updateItem(item.key, { condition_value: e.target.value })
                                      }
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
                                    onChange={(e) =>
                                      updateItem(item.key, { condition_value: e.target.value })
                                    }
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

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => removeItem(item.key)}
                    disabled={items.length <= 1}
                    className="mt-2.5 text-gray-300 hover:text-red-500 disabled:invisible transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-gray-200 px-6 py-3">
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
          >
            <Plus size={14} /> Add Item
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Creating…" : "Create Checklist"}
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
