"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, ChevronUp, ChevronDown, Plus, Pencil, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRequirePermission } from "@/lib/usePermission";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Stop = {
  id: string;
  stop_order: number;
  notes: string | null;
  customers: { id: string; name: string; address: string | null; city: string | null; state: string | null } | null;
};

type Route = {
  id: string;
  name: string;
  description: string | null;
  day_of_week: string | null;
  driver_name: string | null;
  is_active: boolean;
};

type Customer = { id: string; name: string; city: string | null; state: string | null };

export default function DeliveryRouteDetailPage() {
  const { loading: permLoading } = useRequirePermission("customers.view");
  const params = useParams();
  const router = useRouter();
  const routeId = params.id as string;

  const [route, setRoute] = useState<Route | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode for route details
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDriver, setEditDriver] = useState("");
  const [editDays, setEditDays] = useState<string[]>([]);
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Add stop
  const [addingStop, setAddingStop] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [stopNotes, setStopNotes] = useState("");
  const [addingLoading, setAddingLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [routeRes, stopsRes, customersRes] = await Promise.all([
      fetch(`/api/delivery-routes/${routeId}`),
      fetch(`/api/delivery-routes/${routeId}/stops`),
      fetch("/api/customers?limit=500&sort=name&order=asc"),
    ]);
    const routeJson = await routeRes.json();
    const stopsJson = await stopsRes.json();
    const customersJson = await customersRes.json();

    if (!routeRes.ok) { setError(routeJson.error ?? "Route not found."); setLoading(false); return; }

    setRoute(routeJson.data);
    setStops((stopsJson.data ?? []).sort((a: Stop, b: Stop) => a.stop_order - b.stop_order));
    setAllCustomers(customersJson.data ?? []);
    setLoading(false);
  }, [routeId]);

  useEffect(() => { load(); }, [load]);

  function startEdit() {
    if (!route) return;
    setEditName(route.name);
    setEditDesc(route.description ?? "");
    setEditDriver(route.driver_name ?? "");
    setEditDays(route.day_of_week ? route.day_of_week.split(", ").map((d) => d.trim()) : []);
    setEditActive(route.is_active);
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    const res = await fetch(`/api/delivery-routes/${routeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        description: editDesc || null,
        driver_name: editDriver || null,
        day_of_week: editDays.length > 0 ? editDays.join(", ") : null,
        is_active: editActive,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error ?? "Failed to save."); return; }
    setRoute(json.data);
    setEditing(false);
  }

  async function deleteRoute() {
    if (!confirm("Delete this route? This cannot be undone.")) return;
    await fetch(`/api/delivery-routes/${routeId}`, { method: "DELETE" });
    router.push("/customers/routes");
    router.refresh();
  }

  async function addStop() {
    if (!selectedCustomer) return;
    setAddingLoading(true);
    const res = await fetch(`/api/delivery-routes/${routeId}/stops`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: selectedCustomer, notes: stopNotes || null }),
    });
    const json = await res.json();
    setAddingLoading(false);
    if (!res.ok) { setError(json.error ?? "Failed to add stop."); return; }
    setStops((prev) => [...prev, json.data].sort((a, b) => a.stop_order - b.stop_order));
    setSelectedCustomer("");
    setStopNotes("");
    setAddingStop(false);
  }

  async function removeStop(stopId: string) {
    await fetch(`/api/delivery-routes/${routeId}/stops/${stopId}`, { method: "DELETE" });
    setStops((prev) => prev.filter((s) => s.id !== stopId));
  }

  async function moveStop(stopId: string, direction: "up" | "down") {
    const idx = stops.findIndex((s) => s.id === stopId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= stops.length) return;

    const newStops = [...stops];
    const thisOrder = newStops[idx].stop_order;
    const swapOrder = newStops[swapIdx].stop_order;

    // Swap orders optimistically
    newStops[idx] = { ...newStops[idx], stop_order: swapOrder };
    newStops[swapIdx] = { ...newStops[swapIdx], stop_order: thisOrder };
    newStops.sort((a, b) => a.stop_order - b.stop_order);
    setStops(newStops);

    await Promise.all([
      fetch(`/api/delivery-routes/${routeId}/stops/${newStops.find(s => s.id === stopId)!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stop_order: swapOrder }),
      }),
      fetch(`/api/delivery-routes/${routeId}/stops/${stops[swapIdx].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stop_order: thisOrder }),
      }),
    ]);
  }

  function toggleEditDay(day: string) {
    setEditDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  }

  const stopCustomerIds = new Set(stops.map((s) => s.customers?.id).filter(Boolean));
  const availableCustomers = allCustomers.filter((c) => !stopCustomerIds.has(c.id));

  if (permLoading || loading) return <div className="p-8 text-center text-sm text-gray-500">Loading…</div>;
  if (error && !route) return <div className="p-8 text-center text-sm text-red-600">{error}</div>;
  if (!route) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/customers/routes" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
            <ArrowLeft size={16} /> Back to Delivery Routes
          </Link>
          {!editing ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900">{route.name}</h1>
              {route.description && <p className="text-sm text-gray-500 mt-0.5">{route.description}</p>}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-600">
                {route.driver_name && <span>Driver: <strong>{route.driver_name}</strong></span>}
                {route.day_of_week && <span>Days: <strong>{route.day_of_week}</strong></span>}
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${route.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {route.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </>
          ) : (
            <div className="space-y-3 max-w-md">
              <input value={editName} onChange={(e) => setEditName(e.target.value)}
                placeholder="Route name" required
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Description (optional)"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <input value={editDriver} onChange={(e) => setEditDriver(e.target.value)}
                placeholder="Driver name"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => (
                  <button key={day} type="button" onClick={() => toggleEditDay(day)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      editDays.includes(day)
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                    }`}>
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)}
                  className="rounded border-gray-300" />
                Active
              </label>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {!editing ? (
            <>
              <button onClick={startEdit}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <Pencil size={14} /> Edit
              </button>
              <button onClick={deleteRoute}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                <Trash2 size={14} /> Delete
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <X size={14} /> Cancel
              </button>
              <button onClick={saveEdit} disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
                <Check size={14} /> {saving ? "Saving…" : "Save"}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Stops */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Stops ({stops.length})</h2>
          <button onClick={() => setAddingStop((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
            <Plus size={13} /> Add Stop
          </button>
        </div>

        {addingStop && (
          <div className="border-b border-gray-100 bg-blue-50 px-6 py-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-medium text-gray-700 mb-1">Customer</label>
              <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                <option value="">Select customer…</option>
                {availableCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.city ? ` — ${c.city}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-40">
              <label className="block text-xs font-medium text-gray-700 mb-1">Stop Notes (optional)</label>
              <input value={stopNotes} onChange={(e) => setStopNotes(e.target.value)}
                placeholder="e.g., Use side entrance"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setAddingStop(false); setSelectedCustomer(""); setStopNotes(""); }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={addStop} disabled={!selectedCustomer || addingLoading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {addingLoading ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        )}

        {stops.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-400 italic">No stops yet. Add your first stop above.</p>
        ) : (
          <ol className="divide-y divide-gray-100">
            {stops.map((stop, i) => (
              <li key={stop.id} className="flex items-center gap-3 px-6 py-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  {stop.customers ? (
                    <Link href={`/customers/${stop.customers.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800">
                      {stop.customers.name}
                    </Link>
                  ) : (
                    <span className="text-sm text-gray-400 italic">Unknown customer</span>
                  )}
                  {stop.customers?.address && (
                    <p className="text-xs text-gray-500">
                      {stop.customers.address}{stop.customers.city ? `, ${stop.customers.city}` : ""}{stop.customers.state ? `, ${stop.customers.state}` : ""}
                    </p>
                  )}
                  {stop.notes && (
                    <p className="mt-0.5 text-xs text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 inline-block">
                      {stop.notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => moveStop(stop.id, "up")} disabled={i === 0}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30">
                    <ChevronUp size={15} />
                  </button>
                  <button onClick={() => moveStop(stop.id, "down")} disabled={i === stops.length - 1}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30">
                    <ChevronDown size={15} />
                  </button>
                  <button onClick={() => removeStop(stop.id)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 ml-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
