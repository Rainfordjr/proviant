"use client";

import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { UnitSelect } from "@/components/ui/unit-select";

// ── Types exposed to parent forms ─────────────────────────────

export interface IngredientRow {
  raw_material_id: string;
  quantity: string;
  unit: string;
  notes: string;
}

export interface SectionData {
  /** Temporary client-side key (not the DB id) */
  key: string;
  /** Persisted DB id, if this section was loaded from the DB */
  dbId?: string;
  name: string;
  notes: string;
  ingredients: IngredientRow[];
  collapsed?: boolean;
}

/** Unsectioned ingredients live outside any section */
export interface SectionedIngredients {
  unsectioned: IngredientRow[];
  sections: SectionData[];
}

interface Props {
  data: SectionedIngredients;
  onChange: (data: SectionedIngredients) => void;
  materials: { id: string; name: string; unit: string }[];
}

// ── Helpers ────────────────────────────────────────────────────

let keyCounter = 0;
export function newSectionKey() {
  return `sec_${Date.now()}_${++keyCounter}`;
}

// "general" is a sentinel for the unsectioned list
type MoveTarget = "general" | string; // string = section key

// ── Component ──────────────────────────────────────────────────

export function SectionedIngredientEditor({ data, onChange, materials }: Props) {
  const hasSections = data.sections.length > 0;

  // ─ Move an ingredient from one location to another ──────────
  const moveIngredient = (
    fromLocation: MoveTarget,
    fromIdx: number,
    toLocation: MoveTarget,
  ) => {
    if (fromLocation === toLocation) return;

    // Pull the ingredient out of the source
    let ing: IngredientRow;
    const newData = { ...data };

    if (fromLocation === "general") {
      const list = [...data.unsectioned];
      ing = list[fromIdx];
      list.splice(fromIdx, 1);
      newData.unsectioned = list;
    } else {
      const sections = [...data.sections];
      const sIdx = sections.findIndex((s) => s.key === fromLocation);
      if (sIdx === -1) return;
      const ings = [...sections[sIdx].ingredients];
      ing = ings[fromIdx];
      ings.splice(fromIdx, 1);
      sections[sIdx] = { ...sections[sIdx], ingredients: ings };
      newData.sections = sections;
    }

    // Push it into the destination
    if (toLocation === "general") {
      newData.unsectioned = [...(newData.unsectioned || data.unsectioned), ing];
    } else {
      const sections = [...(newData.sections || data.sections)];
      const sIdx = sections.findIndex((s) => s.key === toLocation);
      if (sIdx === -1) return;
      sections[sIdx] = { ...sections[sIdx], ingredients: [...sections[sIdx].ingredients, ing] };
      newData.sections = sections;
    }

    onChange(newData);
  };

  // ─ Reorder helpers ───────────────────────────────────────────
  const reorderUnsectioned = (fromIdx: number, toIdx: number) => {
    const list = [...data.unsectioned];
    const [item] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, item);
    onChange({ ...data, unsectioned: list });
  };

  const reorderSectionIngredient = (sIdx: number, fromIdx: number, toIdx: number) => {
    const sections = [...data.sections];
    const ings = [...sections[sIdx].ingredients];
    const [item] = ings.splice(fromIdx, 1);
    ings.splice(toIdx, 0, item);
    sections[sIdx] = { ...sections[sIdx], ingredients: ings };
    onChange({ ...data, sections });
  };

  // ─ Unsectioned helpers
  const addUnsectioned = () =>
    onChange({
      ...data,
      unsectioned: [...data.unsectioned, { raw_material_id: "", quantity: "", unit: "", notes: "" }],
    });

  const removeUnsectioned = (idx: number) =>
    onChange({ ...data, unsectioned: data.unsectioned.filter((_, i) => i !== idx) });

  const updateUnsectioned = (idx: number, field: keyof IngredientRow, value: string) => {
    const updated = [...data.unsectioned];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === "raw_material_id") {
      const mat = materials.find((m) => m.id === value);
      if (mat) updated[idx].unit = mat.unit;
    }
    onChange({ ...data, unsectioned: updated });
  };

  // ─ Section-level helpers
  const addSection = () =>
    onChange({
      ...data,
      sections: [
        ...data.sections,
        { key: newSectionKey(), name: "", notes: "", ingredients: [{ raw_material_id: "", quantity: "", unit: "", notes: "" }] },
      ],
    });

  const removeSection = (sIdx: number) => {
    // Move any ingredients back to unsectioned before removing
    const section = data.sections[sIdx];
    const remainingIngs = section.ingredients.filter((i) => i.raw_material_id);
    onChange({
      ...data,
      unsectioned: [...data.unsectioned, ...remainingIngs],
      sections: data.sections.filter((_, i) => i !== sIdx),
    });
  };

  const updateSectionField = (sIdx: number, field: "name" | "notes", value: string) => {
    const sections = [...data.sections];
    sections[sIdx] = { ...sections[sIdx], [field]: value };
    onChange({ ...data, sections });
  };

  const toggleCollapsed = (sIdx: number) => {
    const sections = [...data.sections];
    sections[sIdx] = { ...sections[sIdx], collapsed: !sections[sIdx].collapsed };
    onChange({ ...data, sections });
  };

  // ─ Per-section ingredient helpers
  const addSectionIngredient = (sIdx: number) => {
    const sections = [...data.sections];
    sections[sIdx] = {
      ...sections[sIdx],
      ingredients: [...sections[sIdx].ingredients, { raw_material_id: "", quantity: "", unit: "", notes: "" }],
    };
    onChange({ ...data, sections });
  };

  const removeSectionIngredient = (sIdx: number, iIdx: number) => {
    const sections = [...data.sections];
    sections[sIdx] = {
      ...sections[sIdx],
      ingredients: sections[sIdx].ingredients.filter((_, i) => i !== iIdx),
    };
    onChange({ ...data, sections });
  };

  const updateSectionIngredient = (sIdx: number, iIdx: number, field: keyof IngredientRow, value: string) => {
    const sections = [...data.sections];
    const ings = [...sections[sIdx].ingredients];
    ings[iIdx] = { ...ings[iIdx], [field]: value };
    if (field === "raw_material_id") {
      const mat = materials.find((m) => m.id === value);
      if (mat) ings[iIdx].unit = mat.unit;
    }
    sections[sIdx] = { ...sections[sIdx], ingredients: ings };
    onChange({ ...data, sections });
  };

  // ─ Build move target options for a given current location
  const buildMoveOptions = (currentLocation: MoveTarget) => {
    const options: { value: MoveTarget; label: string }[] = [];
    if (currentLocation !== "general") {
      options.push({ value: "general", label: "General" });
    }
    for (const sec of data.sections) {
      if (sec.key !== currentLocation) {
        options.push({ value: sec.key, label: sec.name || "(unnamed section)" });
      }
    }
    return options;
  };

  // ─ Render helpers
  const renderIngredientRow = (
    ing: IngredientRow,
    onUpdate: (field: keyof IngredientRow, value: string) => void,
    onRemove: () => void,
    currentLocation: MoveTarget,
    rowIdx: number,
    listLength: number,
    onMoveUp: (() => void) | null,
    onMoveDown: (() => void) | null,
  ) => {
    const moveOptions = buildMoveOptions(currentLocation);
    const showMove = hasSections && moveOptions.length > 0;

    return (
      <div className="group grid grid-cols-12 gap-3 items-center">
        {/* Reorder controls */}
        <div className="col-span-1 flex flex-col items-center gap-0.5">
          <button
            type="button"
            onClick={onMoveUp ?? undefined}
            disabled={!onMoveUp}
            className="rounded p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-0 disabled:cursor-default"
            title="Move up"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            onClick={onMoveDown ?? undefined}
            disabled={!onMoveDown}
            className="rounded p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-0 disabled:cursor-default"
            title="Move down"
          >
            <ChevronDown size={14} />
          </button>
        </div>
        <div className={showMove ? "col-span-3" : "col-span-3"}>
          <select
            value={ing.raw_material_id}
            onChange={(e) => onUpdate("raw_material_id", e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select material...</option>
            {materials.map((mat) => (
              <option key={mat.id} value={mat.id}>
                {mat.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-1">
          <input
            type="number"
            step="any"
            min="0"
            placeholder="Qty"
            value={ing.quantity}
            onChange={(e) => onUpdate("quantity", e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="col-span-2">
          <UnitSelect value={ing.unit} onChange={(val) => onUpdate("unit", val)} />
        </div>
        <div className={showMove ? "col-span-1" : "col-span-2"}>
          <input
            type="text"
            placeholder="Notes"
            value={ing.notes}
            onChange={(e) => onUpdate("notes", e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {showMove && (
          <div className="col-span-2">
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  moveIngredient(currentLocation, rowIdx, e.target.value as MoveTarget);
                }
              }}
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-xs text-gray-600 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Move to…</option>
              {moveOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  → {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="col-span-1 flex justify-center">
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  };

  const columnHeader = (
    <div className="grid grid-cols-12 gap-3 text-xs font-semibold uppercase text-gray-500 px-1">
      <div className="col-span-1"></div>
      <div className="col-span-3">Material</div>
      <div className="col-span-1">Qty</div>
      <div className="col-span-2">Unit</div>
      <div className={hasSections ? "col-span-1" : "col-span-2"}>Notes</div>
      {hasSections && <div className="col-span-2">Move</div>}
      <div className="col-span-1"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── Unsectioned ingredients (General) ─── */}
      {(data.unsectioned.length > 0 || data.sections.length === 0) && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {hasSections ? "General Ingredients" : "Ingredients"}
              </h2>
              <p className="text-sm text-gray-500">
                {hasSections
                  ? "Ingredients not assigned to a specific section"
                  : "Raw materials needed for this recipe"}
              </p>
            </div>
            <button
              type="button"
              onClick={addUnsectioned}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Plus size={14} /> Add Row
            </button>
          </div>

          {data.unsectioned.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              No general ingredients. Click &quot;Add Row&quot; to start, or add a section below.
            </p>
          ) : (
            <div className="space-y-3">
              {columnHeader}
              {data.unsectioned.map((ing, idx) => (
                <div key={idx}>
                  {renderIngredientRow(
                    ing,
                    (field, value) => updateUnsectioned(idx, field, value),
                    () => removeUnsectioned(idx),
                    "general",
                    idx,
                    data.unsectioned.length,
                    idx > 0 ? () => reorderUnsectioned(idx, idx - 1) : null,
                    idx < data.unsectioned.length - 1 ? () => reorderUnsectioned(idx, idx + 1) : null,
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Named sections ─── */}
      {data.sections.map((section, sIdx) => (
        <div
          key={section.key}
          className="rounded-xl border border-blue-200 bg-white shadow-sm overflow-hidden"
        >
          {/* Section header */}
          <div className="flex items-center gap-3 bg-blue-50 px-6 py-3 border-b border-blue-200">
            <button type="button" onClick={() => toggleCollapsed(sIdx)} className="text-blue-500">
              {section.collapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
            </button>
            <GripVertical size={16} className="text-blue-300" />
            <input
              type="text"
              value={section.name}
              onChange={(e) => updateSectionField(sIdx, "name", e.target.value)}
              placeholder="Section name (e.g., Crust, Filling, Topping)..."
              className="flex-1 bg-transparent border-none text-base font-semibold text-blue-900 placeholder-blue-400 focus:outline-none"
            />
            <span className="text-xs text-blue-500 font-medium">
              {section.ingredients.filter((i) => i.raw_material_id).length} items
            </span>
            <button
              type="button"
              onClick={() => removeSection(sIdx)}
              className="rounded-lg p-1.5 text-blue-400 hover:bg-red-50 hover:text-red-500"
              title="Remove section (ingredients move to General)"
            >
              <Trash2 size={16} />
            </button>
          </div>

          {/* Section body (collapsible) */}
          {!section.collapsed && (
            <div className="p-6 space-y-4">
              {/* Optional section notes */}
              <div>
                <input
                  type="text"
                  value={section.notes}
                  onChange={(e) => updateSectionField(sIdx, "notes", e.target.value)}
                  placeholder="Section notes (optional, e.g., 'Bake crust at 350°F for 15 min before filling')"
                  className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Ingredient rows */}
              {section.ingredients.length === 0 ? (
                <p className="text-sm text-gray-500 py-2 text-center">No ingredients in this section.</p>
              ) : (
                <div className="space-y-3">
                  {columnHeader}
                  {section.ingredients.map((ing, iIdx) => (
                    <div key={iIdx}>
                      {renderIngredientRow(
                        ing,
                        (field, value) => updateSectionIngredient(sIdx, iIdx, field, value),
                        () => removeSectionIngredient(sIdx, iIdx),
                        section.key,
                        iIdx,
                        section.ingredients.length,
                        iIdx > 0 ? () => reorderSectionIngredient(sIdx, iIdx, iIdx - 1) : null,
                        iIdx < section.ingredients.length - 1 ? () => reorderSectionIngredient(sIdx, iIdx, iIdx + 1) : null,
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => addSectionIngredient(sIdx)}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Plus size={14} /> Add Row
              </button>
            </div>
          )}
        </div>
      ))}

      {/* ── Add section button ─── */}
      <button
        type="button"
        onClick={addSection}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-4 text-sm font-medium text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        <Plus size={16} /> Add Section (e.g., Crust, Filling, Topping)
      </button>
    </div>
  );
}
