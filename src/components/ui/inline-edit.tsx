"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Pencil, Check, X } from "lucide-react";

interface InlineEditProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  /** Label shown above the value and as the modal title */
  label?: string;
  /** Render the display value — defaults to plain text */
  renderDisplay?: (value: string) => React.ReactNode;
  /** "text" | "textarea" | "select" */
  type?: "text" | "textarea" | "select";
  /** Options for select type: { value, label } */
  options?: { value: string; label: string }[];
  /** Placeholder when empty */
  placeholder?: string;
  /** Additional className on the wrapper */
  className?: string;
  /** Allow empty / clearing the value */
  allowEmpty?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

export function InlineEdit({
  value,
  onSave,
  label,
  renderDisplay,
  type = "text",
  options,
  placeholder = "Not set",
  className = "",
  allowEmpty = true,
  size = "md",
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  // Focus input when modal opens
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editing]);

  // Close on Escape or click outside
  useEffect(() => {
    if (!editing) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDraft(value);
        setEditing(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        setDraft(value);
        setEditing(false);
      }
    };

    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [editing, value]);

  const handleSave = async () => {
    if (!allowEmpty && !draft.trim()) return;
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      // keep modal open on error
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && type !== "textarea") {
      e.preventDefault();
      handleSave();
    }
  };

  const textSizeClass =
    size === "lg" ? "text-xl font-bold" : size === "sm" ? "text-sm" : "text-base";

  const hasValue = value && value.length > 0;
  const displayContent = renderDisplay
    ? renderDisplay(value)
    : hasValue
    ? <span className={`text-gray-900 ${textSizeClass}`}>{value}</span>
    : <span className={`text-gray-400 italic ${size === "sm" ? "text-sm" : "text-base"}`}>{placeholder}</span>;

  return (
    <div className={`relative ${className}`}>
      {label && (
        <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">
          {label}
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="flex-1">{displayContent}</span>
        <button
          ref={anchorRef}
          onClick={() => { setDraft(value); setEditing(true); }}
          className="shrink-0 rounded p-1 text-gray-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          title={`Edit${label ? ` ${label.toLowerCase()}` : ""}`}
        >
          <Pencil size={size === "lg" ? 14 : 12} />
        </button>
      </div>

      {/* Floating edit modal */}
      {editing && (
        <>
          {/* Backdrop — subtle, doesn't black out the page */}
          <div className="fixed inset-0 z-40" />

          <div
            ref={modalRef}
            className="absolute left-0 top-full z-50 mt-2 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-xl"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Edit {label || "value"}
            </div>

            {type === "textarea" ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            ) : type === "select" ? (
              <select
                ref={inputRef as React.RefObject<HTMLSelectElement>}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {allowEmpty && <option value="">None</option>}
                {(options || []).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}

            <div className="flex items-center justify-end gap-2 mt-3">
              <button
                onClick={() => { setDraft(value); setEditing(false); }}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
