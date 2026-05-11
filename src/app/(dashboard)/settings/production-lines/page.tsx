"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Check, X, Factory } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRequirePermission } from "@/lib/usePermission";
import { ProductionQr } from "@/components/production/production-qr";

type Line = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

export default function ProductionLinesPage() {
  const { loading: permLoading } = useRequirePermission("production_lines.view");
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editActive, setEditActive] = useState(true);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("production_lines")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) {
      setError(error.message);
    } else {
      setLines((data || []) as Line[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createLine() {
    if (!newName.trim()) return;
    setError(null);
    const res = await fetch("/api/production-lines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        description: newDesc.trim() || null,
        is_active: true,
        sort_order: lines.length,
      }),
    });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error || "Failed to create");
      return;
    }
    setNewName("");
    setNewDesc("");
    setAdding(false);
    await load();
  }

  function startEdit(line: Line) {
    setEditingId(line.id);
    setEditName(line.name);
    setEditDesc(line.description || "");
    setEditActive(line.is_active);
  }

  async function saveEdit() {
    if (!editingId) return;
    setError(null);
    const res = await fetch(`/api/production-lines/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        description: editDesc.trim() || null,
        is_active: editActive,
      }),
    });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error || "Failed to save");
      return;
    }
    setEditingId(null);
    await load();
  }

  async function deleteLine(id: string) {
    if (!confirm("Delete this production line? Batches assigned to it will be unassigned.")) return;
    setError(null);
    const res = await fetch(`/api/production-lines/${id}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j.error || "Failed to delete");
      return;
    }
    await load();
  }

  if (permLoading) {
    return <div className="p-8 text-sm text-gray-500">Checking permissions…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Factory size={22} /> Production Lines
          </h1>
          <p className="text-sm text-gray-500">
            Workstations, benches, or ovens. Batches can be scheduled to a line and the production app filters its queue by line.
          </p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} /> Add Line
          </button>
        )}
      </div>

      <ProductionQr />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {adding && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-blue-900">New Production Line</h2>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Line name (e.g., Mixer 1, Oven 2, Assembly Bench)"
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          />
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setAdding(false); setNewName(""); setNewDesc(""); }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={createLine}
              disabled={!newName.trim()}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Description</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">Loading…</td></tr>
            ) : lines.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">No production lines yet. Add one to start scheduling batches.</td></tr>
            ) : lines.map((line) => (
              <tr key={line.id} className="hover:bg-gray-50">
                {editingId === line.id ? (
                  <>
                    <td className="px-4 py-3">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)}
                        className="block w-full rounded-lg border border-gray-300 px-2 py-1 text-sm" />
                    </td>
                    <td className="px-4 py-3">
                      <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                        className="block w-full rounded-lg border border-gray-300 px-2 py-1 text-sm" />
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-1.5 text-sm">
                        <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                        Active
                      </label>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button onClick={saveEdit} className="rounded p-1.5 text-green-600 hover:bg-green-50" title="Save">
                          <Check size={16} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Cancel">
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">{line.name}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{line.description || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-4">
                      {line.is_active ? (
                        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Active</span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="inline-flex gap-1">
                        <button onClick={() => startEdit(line)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Edit">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => deleteLine(line.id)} className="rounded p-1.5 text-red-500 hover:bg-red-50" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
