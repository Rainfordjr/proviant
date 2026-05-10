"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Check } from "lucide-react";

type IngredientLine = {
  rvi_id: string;
  ingredient_id: string;
  ingredient_name: string;
  required_qty: number;
  unit: string;
  consumed_qty: number;
};

type LotOption = {
  id: string;
  lot_number: string;
  raw_material_id: string;
  raw_material_name: string;
  quantity_remaining: number;
  unit: string;
  expiry_date: string | null;
};

type Row = {
  key: string;
  lot_id: string;
  qty: string;
  saving: boolean;
  error: string | null;
};

export function BulkConsumptionEditor({
  batchId,
  lines,
  lotsByIngredient,
}: {
  batchId: string;
  lines: IngredientLine[];
  lotsByIngredient: Record<string, LotOption[]>;
}) {
  const router = useRouter();
  const [rowsByIngredient, setRowsByIngredient] = useState<Record<string, Row[]>>(() => {
    const init: Record<string, Row[]> = {};
    for (const line of lines) {
      const remaining = Math.max(0, line.required_qty - line.consumed_qty);
      if (remaining > 0) {
        init[line.ingredient_id] = [
          { key: crypto.randomUUID(), lot_id: "", qty: String(remaining), saving: false, error: null },
        ];
      }
    }
    return init;
  });

  function setRow(ingId: string, key: string, patch: Partial<Row>) {
    setRowsByIngredient((prev) => ({
      ...prev,
      [ingId]: (prev[ingId] || []).map((r) => (r.key === key ? { ...r, ...patch } : r)),
    }));
  }

  function addRow(ingId: string) {
    setRowsByIngredient((prev) => ({
      ...prev,
      [ingId]: [
        ...(prev[ingId] || []),
        { key: crypto.randomUUID(), lot_id: "", qty: "", saving: false, error: null },
      ],
    }));
  }

  function removeRow(ingId: string, key: string) {
    setRowsByIngredient((prev) => ({
      ...prev,
      [ingId]: (prev[ingId] || []).filter((r) => r.key !== key),
    }));
  }

  async function saveRow(ingId: string, row: Row) {
    if (!row.lot_id) {
      setRow(ingId, row.key, { error: "Pick a lot first." });
      return;
    }
    const qty = Number(row.qty);
    if (!(qty > 0)) {
      setRow(ingId, row.key, { error: "Quantity must be greater than zero." });
      return;
    }
    setRow(ingId, row.key, { saving: true, error: null });
    const r = await fetch(`/api/batches/${batchId}/consumptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ingredient_id: ingId,
        material_lot_id: row.lot_id,
        quantity_used: qty,
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      setRow(ingId, row.key, { saving: false, error: j.error || "Save failed" });
      return;
    }
    // Remove the saved row; the server-side state will refresh on router.refresh().
    setRowsByIngredient((prev) => ({
      ...prev,
      [ingId]: (prev[ingId] || []).filter((r) => r.key !== row.key),
    }));
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">
            Record Materials Used
          </h2>
          <span className="text-xs text-gray-500 font-medium">
            After-action mode
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Pick the lot you used for each ingredient and enter the quantity. Save each row when ready.
        </p>
      </div>

      <ul className="divide-y divide-gray-100">
        {lines.map((line) => {
          const done = line.consumed_qty >= line.required_qty;
          const lots = lotsByIngredient[line.ingredient_id] || [];
          const rows = rowsByIngredient[line.ingredient_id] || [];
          const remaining = Math.max(0, line.required_qty - line.consumed_qty);

          return (
            <li key={line.ingredient_id} className="px-4 py-4 sm:px-6">
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <div>
                  <h3 className={`text-base font-semibold ${done ? "line-through text-gray-400" : "text-gray-900"}`}>
                    {line.ingredient_name}
                  </h3>
                  <p className="text-xs text-gray-500 tabular-nums">
                    {line.consumed_qty} / {line.required_qty} {line.unit} consumed
                    {!done && remaining > 0 && (
                      <> · <span className="text-amber-700">{remaining} {line.unit} remaining</span></>
                    )}
                  </p>
                </div>
                {done && <Check size={20} className="text-green-600 flex-shrink-0" />}
              </div>

              {!done && lots.length === 0 && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  No active lots available that satisfy this ingredient. Receive a lot first or update the recipe&apos;s substitution rules.
                </p>
              )}

              {!done && lots.length > 0 && (
                <div className="space-y-3">
                  {rows.map((row) => (
                    <div key={row.key} className="rounded-lg border border-gray-200 p-3 space-y-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
                        <select
                          value={row.lot_id}
                          onChange={(e) => setRow(line.ingredient_id, row.key, { lot_id: e.target.value, error: null })}
                          className="block w-full rounded-lg border border-gray-300 px-3 py-3 text-base bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="">Pick a lot…</option>
                          {lots.map((lot) => (
                            <option key={lot.id} value={lot.id}>
                              {lot.raw_material_name} — Lot {lot.lot_number} ({lot.quantity_remaining} {lot.unit}
                              {lot.expiry_date ? `, exp ${lot.expiry_date}` : ""})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          inputMode="decimal"
                          value={row.qty}
                          onChange={(e) => setRow(line.ingredient_id, row.key, { qty: e.target.value, error: null })}
                          placeholder={`Qty (${line.unit})`}
                          className="block w-full sm:w-32 rounded-lg border border-gray-300 px-3 py-3 text-base tabular-nums focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                        <div className="flex gap-2">
                          {rows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeRow(line.ingredient_id, row.key)}
                              className="rounded-lg border border-gray-300 px-3 py-3 text-gray-600 active:bg-gray-100"
                              aria-label="Remove row"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={row.saving}
                            onClick={() => saveRow(line.ingredient_id, row)}
                            className="rounded-lg bg-green-600 px-4 py-3 text-base font-semibold text-white active:bg-green-700 disabled:opacity-50"
                          >
                            {row.saving ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                      {row.error && (
                        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1">
                          {row.error}
                        </p>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addRow(line.ingredient_id)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    <Plus size={14} /> Split across another lot
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
