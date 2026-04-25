"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle, CheckSquare, Square, Camera, PenTool,
  Thermometer, Hash, CalendarClock, ScanBarcode,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CHECKLIST_ANSWER_TYPES } from "@/lib/constants";
import type { ChecklistTemplateItem } from "@/types/database";

interface Props {
  checklistId: string;
  versionId: string;
  items: ChecklistTemplateItem[];
  orgId: string;
  currentUserId: string;
  checklistName: string;
  versionNumber: number;
}

interface AnswerState {
  value: string | null;
  meta: Record<string, unknown> | null;
}

export function ChecklistRun({
  checklistId,
  versionId,
  items,
  orgId,
  currentUserId,
  checklistName,
  versionNumber,
}: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setAnswer = useCallback((itemId: string, value: string | null, meta?: Record<string, unknown> | null) => {
    setAnswers((prev) => ({
      ...prev,
      [itemId]: { value, meta: meta || null },
    }));
  }, []);

  // Evaluate conditional visibility
  function isItemVisible(item: ChecklistTemplateItem): boolean {
    if (!item.condition_item_id) return true;
    const source = items.find((i) => i.id === item.condition_item_id);
    if (!source) return true;
    const sourceVal = answers[source.id]?.value || "";
    const condVal = item.condition_value || "";
    switch (item.condition_operator) {
      case "equals":     return sourceVal === condVal;
      case "not_equals": return sourceVal !== condVal;
      case "contains":   return sourceVal.includes(condVal);
      case "not_empty":  return sourceVal.trim().length > 0;
      case "gt":         return Number(sourceVal) > Number(condVal);
      case "lt":         return Number(sourceVal) < Number(condVal);
      case "gte":        return Number(sourceVal) >= Number(condVal);
      case "lte":        return Number(sourceVal) <= Number(condVal);
      default:           return true;
    }
  }

  const visibleItems = items.filter(isItemVisible);
  const answeredCount = visibleItems.filter((i) => answers[i.id]?.value).length;
  const totalVisible = visibleItems.length;
  const progress = totalVisible > 0 ? (answeredCount / totalVisible) * 100 : 0;

  // Validate required items
  function validate(): boolean {
    for (const item of visibleItems) {
      if (item.is_required && !answers[item.id]?.value) {
        setError(`Required item "${item.label}" must be answered`);
        return false;
      }
    }
    return true;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    setError("");
    const supabase = createClient();

    // Create the run
    const { data: run, error: rErr } = await supabase
      .from("checklist_runs")
      .insert({
        org_id: orgId,
        checklist_id: checklistId,
        version_id: versionId,
        started_by: currentUserId,
        completed_by: currentUserId,
        status: "completed",
        notes: notes.trim() || null,
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (rErr || !run) {
      setError(rErr?.message || "Failed to create run");
      setSaving(false);
      return;
    }

    // Insert answers
    const answerPayloads = visibleItems
      .filter((item) => answers[item.id]?.value)
      .map((item) => ({
        run_id: run.id,
        item_id: item.id,
        answer_type: item.answer_type,
        answer_value: answers[item.id].value,
        answer_meta: answers[item.id].meta ? JSON.stringify(answers[item.id].meta) : null,
        item_config: item.config ? JSON.stringify(item.config) : null,
      }));

    if (answerPayloads.length > 0) {
      const { error: aErr } = await supabase
        .from("checklist_run_answers")
        .insert(answerPayloads);

      if (aErr) {
        setError(aErr.message || "Failed to save answers");
        setSaving(false);
        return;
      }
    }

    router.push(`/tasks/checklists/${checklistId}/runs/${run.id}`);
    router.refresh();
  }

  const inputClass =
    "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300";

  // Hierarchical numbering (1, 1a, 1b, 2, etc.)
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
        <h1 className="text-xl font-bold text-gray-900">{checklistName}</h1>
        <p className="text-sm text-gray-500 mt-1">Running version {versionNumber}</p>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>{answeredCount} of {totalVisible} answered</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progress === 100 ? "bg-green-500" : "bg-blue-500"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">
        {items.map((item, idx) => {
          const visible = isItemVisible(item);
          if (!visible) return null;

          const answer = answers[item.id];
          const typeInfo = CHECKLIST_ANSWER_TYPES[item.answer_type as keyof typeof CHECKLIST_ANSWER_TYPES];
          const options: string[] = item.answer_options
            ? (typeof item.answer_options === "string" ? JSON.parse(item.answer_options as string) : item.answer_options)
            : [];
          const config = (item.config || {}) as Record<string, unknown>;

          return (
            <div
              key={item.id}
              className={`px-6 py-4 ${item.condition_item_id ? "ml-6 border-l-2 border-amber-200" : ""}`}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500">
                  {numbering[idx]}
                </span>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-700">{item.label}</p>
                    {item.is_required && <span className="text-[10px] font-medium text-red-500">Required</span>}
                    {typeInfo && item.answer_type !== "checkbox" && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                        {typeInfo.label}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-gray-400">{item.description}</p>
                  )}

                  {/* ── Answer inputs by type ──────────────── */}

                  {/* Checkbox */}
                  {item.answer_type === "checkbox" && (
                    <button
                      onClick={() => setAnswer(item.id, answer?.value === "checked" ? null : "checked")}
                      className={`inline-flex items-center gap-2 transition-colors ${
                        answer?.value === "checked" ? "text-green-500" : "text-gray-300 hover:text-blue-500"
                      }`}
                    >
                      {answer?.value === "checked" ? <CheckSquare size={20} /> : <Square size={20} />}
                      <span className="text-sm">{answer?.value === "checked" ? "Done" : "Mark complete"}</span>
                    </button>
                  )}

                  {/* Yes/No */}
                  {item.answer_type === "yes_no" && (
                    <div className="flex gap-2">
                      {["yes", "no"].map((val) => (
                        <button
                          key={val}
                          onClick={() => setAnswer(item.id, answer?.value === val ? null : val)}
                          className={`rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors ${
                            answer?.value === val
                              ? val === "yes" ? "border-green-300 bg-green-50 text-green-700" : "border-red-300 bg-red-50 text-red-700"
                              : "border-gray-200 text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          {val === "yes" ? "Yes" : "No"}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* True/False */}
                  {item.answer_type === "true_false" && (
                    <div className="flex gap-2">
                      {["true", "false"].map((val) => (
                        <button
                          key={val}
                          onClick={() => setAnswer(item.id, answer?.value === val ? null : val)}
                          className={`rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors ${
                            answer?.value === val
                              ? val === "true" ? "border-green-300 bg-green-50 text-green-700" : "border-red-300 bg-red-50 text-red-700"
                              : "border-gray-200 text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          {val === "true" ? "True" : "False"}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Text */}
                  {item.answer_type === "text" && (
                    <input
                      type="text"
                      defaultValue={answer?.value || ""}
                      placeholder="Type your answer…"
                      onBlur={(e) => setAnswer(item.id, e.target.value.trim() || null)}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      className={inputClass}
                    />
                  )}

                  {/* Number */}
                  {item.answer_type === "number" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        defaultValue={answer?.value || ""}
                        placeholder={`Enter number${config.min !== undefined ? ` (min: ${config.min})` : ""}${config.max !== undefined ? ` (max: ${config.max})` : ""}`}
                        min={config.min as number | undefined}
                        max={config.max as number | undefined}
                        onBlur={(e) => setAnswer(item.id, e.target.value.trim() || null)}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        className={`${inputClass} w-48`}
                      />
                    </div>
                  )}

                  {/* Temperature */}
                  {item.answer_type === "temperature" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        defaultValue={answer?.value || ""}
                        placeholder="Temperature"
                        onBlur={(e) => setAnswer(item.id, e.target.value.trim() || null)}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        className={`${inputClass} w-32`}
                      />
                      <span className="text-sm text-gray-500">°{(config.unit as string) || "F"}</span>
                    </div>
                  )}

                  {/* DateTime */}
                  {item.answer_type === "datetime" && (
                    <input
                      type="datetime-local"
                      defaultValue={answer?.value || ""}
                      onChange={(e) => setAnswer(item.id, e.target.value || null)}
                      className={`${inputClass} w-64`}
                    />
                  )}

                  {/* Select (dropdown) */}
                  {item.answer_type === "select" && options.length > 0 && (
                    <select
                      value={answer?.value || ""}
                      onChange={(e) => setAnswer(item.id, e.target.value || null)}
                      className={`${inputClass} w-64`}
                    >
                      <option value="">Select…</option>
                      {options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}

                  {/* Radio */}
                  {item.answer_type === "radio" && options.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {options.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setAnswer(item.id, answer?.value === opt ? null : opt)}
                          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                            answer?.value === opt
                              ? "border-blue-300 bg-blue-50 text-blue-700"
                              : "border-gray-200 text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Multi-select */}
                  {item.answer_type === "multi_select" && options.length > 0 && (() => {
                    const selected: string[] = answer?.value ? answer.value.split(",") : [];
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
                                setAnswer(item.id, next.length > 0 ? next.join(",") : null, { selections: next });
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

                  {/* Photo (placeholder — file upload not implemented) */}
                  {item.answer_type === "photo" && (
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors">
                        <Camera size={16} />
                        {answer?.value ? "Photo attached" : "Upload Photo"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setAnswer(item.id, file.name, { filename: file.name });
                          }}
                        />
                      </label>
                      {answer?.value && (
                        <span className="text-xs text-green-600">{answer.value}</span>
                      )}
                    </div>
                  )}

                  {/* Barcode */}
                  {item.answer_type === "barcode_scan" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        defaultValue={answer?.value || ""}
                        placeholder="Scan or type barcode…"
                        onBlur={(e) => setAnswer(item.id, e.target.value.trim() || null)}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        className={`${inputClass} w-64`}
                      />
                      <ScanBarcode size={18} className="text-gray-400" />
                    </div>
                  )}

                  {/* Text match */}
                  {item.answer_type === "text_match" && (
                    <input
                      type="text"
                      defaultValue={answer?.value || ""}
                      placeholder="Enter matching text…"
                      onBlur={(e) => setAnswer(item.id, e.target.value.trim() || null)}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      className={inputClass}
                    />
                  )}

                  {/* Employee list (simplified — uses text for now) */}
                  {item.answer_type === "employee_list" && (
                    <input
                      type="text"
                      defaultValue={answer?.value || ""}
                      placeholder="Enter employee name…"
                      onBlur={(e) => setAnswer(item.id, e.target.value.trim() || null)}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      className={inputClass}
                    />
                  )}

                  {/* Signature (placeholder) */}
                  {item.answer_type === "signature" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAnswer(item.id, answer?.value ? null : "signed", { signed_at: new Date().toISOString() })}
                        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                          answer?.value
                            ? "border-green-300 bg-green-50 text-green-700"
                            : "border-gray-200 text-gray-500 hover:bg-gray-50"
                        }`}
                      >
                        <PenTool size={16} />
                        {answer?.value ? "Signed" : "Sign Here"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Notes + Submit */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this run…"
            rows={3}
            className={inputClass}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Submitting…" : "Complete Run"}
          </button>
          <button
            onClick={() => router.back()}
            className="rounded-lg border border-gray-200 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
