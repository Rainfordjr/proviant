"use client";

import { UNITS } from "@/lib/constants";

interface UnitSelectProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  required?: boolean;
  className?: string;
  /** Show a blank "Select unit…" placeholder option (default true) */
  showPlaceholder?: boolean;
}

/**
 * Standardized unit dropdown used everywhere an ingredient or yield unit
 * is selected. Pulls from the shared UNITS constant so every value is
 * consistent and ready for future conversion logic.
 */
export function UnitSelect({
  value,
  onChange,
  id,
  required,
  className = "block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
  showPlaceholder = true,
}: UnitSelectProps) {
  // Group units by category for the optgroup display
  const weight = UNITS.filter((u) => u.category === "weight");
  const volume = UNITS.filter((u) => u.category === "volume");
  const count = UNITS.filter((u) => u.category === "count");

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className={className}
    >
      {showPlaceholder && <option value="">Select unit…</option>}
      <optgroup label="Weight">
        {weight.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}
          </option>
        ))}
      </optgroup>
      <optgroup label="Volume">
        {volume.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}
          </option>
        ))}
      </optgroup>
      <optgroup label="Count / Packaging">
        {count.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
