"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ScanBarcode, Check, X, ChevronDown } from "lucide-react";

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
  const [listOpen, setListOpen] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeIngredientId]);

  const activeLine = lines.find((l) => l.ingredient_id === activeIngredientId) ?? null;
  const remainingForActive = activeLine
    ? Math.max(0, activeLine.required_qty - activeLine.consumed_qty)
    : 0;
  const doneCount = lines.filter((l) => l.consumed_qty >= l.required_qty).length;

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

      if (activeLine && data.raw_materials?.ingredient_id !== activeLine.ingredient_id) {
        const actual = data.raw_materials?.ingredients?.name || "unknown ingredient";
        setError(
          `Scanned lot is for ${actual}; this slot needs ${activeLine.ingredient_name}.`
        );
        setWorking(false);
        return;
      }

      setLookup(data);
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

    const next = updated.find(
      (l) => l.ingredient_id !== activeLine.ingredient_id && l.consumed_qty < l.required_qty
    ) ??
      updated.find((l) => l.consumed_qty < l.required_qty);
    setActiveIngredientId(next?.ingredient_id ?? activeLine.ingredient_id);
    setWorking(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Sticky scanner header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">
              Consume Materials
            </h2>
            <span className="text-xs text-gray-500 font-medium">
              {doneCount}/{lines.length} done
            </span>
          </div>

          {!activeLine ? (
            <p className="mt-2 text-sm text-gray-500">All ingredients consumed.</p>
          ) : (
            <>
              <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2.5">
                <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">
                  Scanning for
                </p>
                <p className="text-base font-semibold text-blue-900 mt-0.5">
                  {activeLine.ingredient_name}
                </p>
                <p className="text-sm text-blue-800 mt-0.5">
                  {remainingForActive} {activeLine.unit} remaining
                </p>
              </div>

              <div className="mt-3 space-y-2">
                <div className="relative">
                  <ScanBarcode
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    size={18}
                  />
                  <input
                    ref={inputRef}
                    value={barcodeText}
                    onChange={(e) => setBarcodeText(e.target.value)}
                    onKeyDown={onBarcodeKey}
                    placeholder="Scan or type lot barcode"
                    inputMode="text"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    autoComplete="off"
                    spellCheck={false}
                    className="block w-full rounded-lg border border-gray-300 pl-10 pr-3 py-3 text-base font-mono focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 text-base font-medium text-gray-700 active:bg-gray-100 sm:py-2.5"
                >
                  <Camera size={18} /> Use camera
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-4 sm:px-6 space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {lookup && activeLine && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
            <div>
              <p className="font-semibold text-green-900">
                {lookup.raw_materials?.name}
              </p>
              <p className="text-sm text-green-800">Lot {lookup.lot_number}</p>
              <p className="text-xs text-green-700 mt-1">
                Lot has {lookup.quantity_remaining} {lookup.raw_materials?.unit || ""} remaining
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                Quantity to consume
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-3 text-lg font-medium tabular-nums focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="mt-1 text-xs text-gray-500">{activeLine.unit}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setLookup(null);
                  setBarcodeText("");
                  setQtyInput("");
                  inputRef.current?.focus();
                }}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-gray-300 px-4 py-3 text-base font-medium text-gray-700 active:bg-gray-100"
              >
                <X size={16} /> Cancel
              </button>
              <button
                type="button"
                disabled={working}
                onClick={confirmConsumption}
                className="flex-[2] inline-flex items-center justify-center gap-1 rounded-lg bg-green-600 px-4 py-3 text-base font-semibold text-white active:bg-green-700 disabled:opacity-50"
              >
                <Check size={18} /> {working ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        )}

        {/* Collapsible ingredient list */}
        <div>
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            className="w-full flex items-center justify-between text-sm font-medium text-gray-700 py-2"
          >
            <span>All ingredients ({lines.length})</span>
            <ChevronDown
              size={16}
              className={`transition-transform ${listOpen ? "rotate-180" : ""}`}
            />
          </button>
          {listOpen && (
            <ul className="mt-1 divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
              {lines.map((line) => {
                const done = line.consumed_qty >= line.required_qty;
                const partial = !done && line.consumed_qty > 0;
                const isActive = activeIngredientId === line.ingredient_id;
                return (
                  <li
                    key={line.ingredient_id}
                    onClick={() => {
                      setActiveIngredientId(line.ingredient_id);
                      setBarcodeText("");
                      setLookup(null);
                      setError(null);
                      setListOpen(false);
                    }}
                    className={`px-4 py-3 cursor-pointer active:bg-gray-100 ${
                      isActive ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`text-base ${
                          done ? "line-through text-gray-400" : "text-gray-900"
                        }`}
                      >
                        {line.ingredient_name}
                      </span>
                      {done ? (
                        <Check size={18} className="text-green-600 flex-shrink-0" />
                      ) : partial ? (
                        <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full flex-shrink-0">
                          partial
                        </span>
                      ) : null}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5 tabular-nums">
                      {line.consumed_qty} / {line.required_qty} {line.unit}
                    </div>
                  </li>
                );
              })}
            </ul>
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

        // Prefer a back camera ("environment"). Fall back to default device
        // selection if enumeration fails or no environment camera exists.
        let deviceId: string | undefined;
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cameras = devices.filter((d) => d.kind === "videoinput");
          const back = cameras.find((d) => /back|rear|environment/i.test(d.label));
          deviceId = back?.deviceId;
        } catch {
          // ignore — pass undefined to let zxing pick
        }

        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current!,
          (result) => {
            if (cancelled) return;
            if (result) {
              const text = result.getText();
              if (text) onCode(text);
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
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <h3 className="font-semibold">Scan barcode</h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 -mr-2 active:bg-white/10 rounded-lg"
          aria-label="Close camera"
        >
          <X size={24} />
        </button>
      </div>
      <div className="flex-1 relative overflow-hidden">
        {err ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="bg-white rounded-lg p-4 max-w-sm">
              <p className="text-sm text-red-700">{err}</p>
              <button
                type="button"
                onClick={onCancel}
                className="mt-3 w-full rounded-lg bg-gray-900 text-white px-4 py-2.5 text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-64 h-40 border-2 border-white/80 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
            </div>
          </>
        )}
      </div>
      <div className="px-4 py-3 text-center text-white/80 text-sm">
        Point at a lot label QR or barcode
      </div>
    </div>
  );
}
