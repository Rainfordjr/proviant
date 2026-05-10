"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ScanBarcode, Check, X } from "lucide-react";

type IngredientLine = {
  rvi_id: string;
  ingredient_id: string;
  ingredient_name: string;
  required_qty: number;
  unit: string;
  consumed_qty: number;
};

type LotLookup = {
  id: string;
  lot_number: string;
  barcode: string | null;
  quantity_remaining: number;
  expiry_date: string | null;
  raw_materials: {
    id: string;
    name: string;
    unit: string;
    ingredient_id: string;
    ingredients: { id: string; name: string; unit: string } | null;
  } | null;
};

export function ConsumptionScanner({
  batchId,
  lines: initialLines,
}: {
  batchId: string;
  lines: IngredientLine[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [lines, setLines] = useState(initialLines);
  const [activeIngredientId, setActiveIngredientId] = useState<string | null>(
    initialLines.find((l) => l.consumed_qty < l.required_qty)?.ingredient_id ??
      initialLines[0]?.ingredient_id ??
      null
  );
  const [barcodeText, setBarcodeText] = useState("");
  const [lookup, setLookup] = useState<LotLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [qtyInput, setQtyInput] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeIngredientId]);

  const activeLine = lines.find((l) => l.ingredient_id === activeIngredientId) ?? null;

  async function handleLookup(code: string) {
    setError(null);
    setLookup(null);
    if (!code.trim()) return;
    setWorking(true);
    try {
      const r = await fetch(`/api/material-lots/by-barcode/${encodeURIComponent(code.trim())}`);
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || "Lookup failed");
        setWorking(false);
        return;
      }
      const data: LotLookup = j.data;

      // Client-side ingredient guard (server re-validates anyway)
      if (activeLine && data.raw_materials?.ingredient_id !== activeLine.ingredient_id) {
        const actual = data.raw_materials?.ingredients?.name || "unknown ingredient";
        setError(
          `Scanned lot is for ${actual}; this slot needs ${activeLine.ingredient_name}.`
        );
        setWorking(false);
        return;
      }

      setLookup(data);
      // Default qty: remaining requirement, capped by lot quantity remaining
      if (activeLine) {
        const remaining = Math.max(0, activeLine.required_qty - activeLine.consumed_qty);
        const cap = Math.min(remaining || activeLine.required_qty, data.quantity_remaining);
        setQtyInput(String(cap));
      }
      setWorking(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setWorking(false);
    }
  }

  function onBarcodeKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleLookup(barcodeText);
    }
  }

  async function confirmConsumption() {
    if (!activeLine || !lookup) return;
    const qty = Number(qtyInput);
    if (!(qty > 0)) {
      setError("Quantity must be greater than zero.");
      return;
    }
    setWorking(true);
    setError(null);
    const r = await fetch(`/api/batches/${batchId}/consumptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ingredient_id: activeLine.ingredient_id,
        material_lot_id: lookup.id,
        quantity_used: qty,
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Save failed");
      setWorking(false);
      return;
    }

    // Mark consumed locally + advance focus
    const updated = lines.map((l) =>
      l.ingredient_id === activeLine.ingredient_id
        ? { ...l, consumed_qty: l.consumed_qty + qty }
        : l
    );
    setLines(updated);
    setBarcodeText("");
    setLookup(null);
    setQtyInput("");
    setError(null);

    // Advance to next pending row
    const next = updated.find(
      (l) => l.ingredient_id !== activeLine.ingredient_id && l.consumed_qty < l.required_qty
    ) ??
      updated.find((l) => l.consumed_qty < l.required_qty);
    setActiveIngredientId(next?.ingredient_id ?? activeLine.ingredient_id);
    setWorking(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Consume Materials</h2>
          <p className="text-sm text-gray-500">Scan a lot barcode for each ingredient.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {lines.map((line) => {
              const done = line.consumed_qty >= line.required_qty;
              const partial = !done && line.consumed_qty > 0;
              return (
                <li
                  key={line.ingredient_id}
                  className={`px-3 py-2 cursor-pointer text-sm ${
                    activeIngredientId === line.ingredient_id
                      ? "bg-blue-50"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => {
                    setActiveIngredientId(line.ingredient_id);
                    setBarcodeText("");
                    setLookup(null);
                    setError(null);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className={done ? "line-through text-gray-400" : "text-gray-900"}>
                      {line.ingredient_name}
                    </span>
                    {done ? (
                      <Check size={14} className="text-green-600" />
                    ) : partial ? (
                      <span className="text-xs text-amber-600">partial</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-500">
                    {line.consumed_qty}/{line.required_qty} {line.unit}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="md:col-span-2 space-y-4">
          {!activeLine ? (
            <p className="text-sm text-gray-500">All ingredients consumed.</p>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scanning for: <strong>{activeLine.ingredient_name}</strong>
                  <span className="text-gray-500 font-normal"> ({Math.max(0, activeLine.required_qty - activeLine.consumed_qty)} {activeLine.unit} remaining)</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      ref={inputRef}
                      value={barcodeText}
                      onChange={(e) => setBarcodeText(e.target.value)}
                      onKeyDown={onBarcodeKey}
                      placeholder="Scan or type a lot barcode, then press Enter"
                      className="block w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCameraOpen(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Camera size={16} /> Camera
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {lookup && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
                  <div className="text-sm">
                    <p className="font-semibold text-green-900">
                      {lookup.raw_materials?.name} — Lot {lookup.lot_number}
                    </p>
                    <p className="text-green-800 text-xs mt-1">
                      Lot remaining: {lookup.quantity_remaining}{" "}
                      {lookup.raw_materials?.unit || ""}
                    </p>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Quantity to consume</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={qtyInput}
                        onChange={(e) => setQtyInput(e.target.value)}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLookup(null);
                        setBarcodeText("");
                      }}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <X size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={working}
                      onClick={confirmConsumption}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {working ? "Saving…" : "Confirm"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {cameraOpen && (
        <CameraModal
          onCancel={() => setCameraOpen(false)}
          onCode={(code) => {
            setCameraOpen(false);
            setBarcodeText(code);
            handleLookup(code);
          }}
        />
      )}
    </div>
  );
}

function CameraModal({
  onCancel,
  onCode,
}: {
  onCancel: () => void;
  onCode: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result) => {
            if (cancelled) return;
            if (result) {
              const text = result.getText();
              if (text) {
                onCode(text);
              }
            }
          }
        );
        stop = () => controls.stop();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [onCode]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl p-4 max-w-md w-full">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Scan with camera</h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-900"
          >
            <X size={18} />
          </button>
        </div>
        {err ? (
          <p className="text-sm text-red-700">{err}</p>
        ) : (
          <video ref={videoRef} className="w-full rounded-lg bg-black" />
        )}
        <p className="mt-2 text-xs text-gray-500">Point at a lot label QR or barcode.</p>
      </div>
    </div>
  );
}
