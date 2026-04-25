"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_COLORS } from "@/lib/constants";

interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
  is_active: boolean;
}

interface Props {
  categories: Category[];
  orgId: string;
  type: "checklist" | "task";
}

export function CategoriesManager({ categories, orgId, type }: Props) {
  const router = useRouter();
  const table = type === "checklist" ? "checklist_categories" : "task_categories";
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColor, setEditColor] = useState("#3B82F6");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState("#3B82F6");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from(table).insert({
      org_id: orgId,
      name: newName.trim(),
      description: newDescription.trim() || null,
      color: newColor,
      sort_order: categories.length,
    });
    setNewName("");
    setNewDescription("");
    setNewColor("#3B82F6");
    setShowNew(false);
    setSaving(false);
    router.refresh();
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) return;
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from(table)
      .update({
        name: editName.trim(),
        description: editDescription.trim() || null,
        color: editColor,
      })
      .eq("id", id);
    setEditingId(null);
    setSaving(false);
    router.refresh();
  }

  async function toggleActive(id: string, currentlyActive: boolean) {
    const supabase = createClient();
    await supabase.from(table).update({ is_active: !currentlyActive }).eq("id", id);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this category? Items using it will be uncategorized.")) return;
    const supabase = createClient();
    await supabase.from(table).delete().eq("id", id);
    router.refresh();
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDescription(cat.description || "");
    setEditColor(cat.color);
  }

  const inputClass =
    "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Category list */}
      <div className="lg:col-span-2">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-sm font-semibold text-gray-700">
              {type === "checklist" ? "Checklist" : "Task"} Categories
            </h2>
            <span className="text-xs text-gray-400">{categories.length} total</span>
          </div>

          {categories.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-400">
              No categories yet. Create one to get started.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {categories.map((cat) => (
                <div key={cat.id} className="px-6 py-4">
                  {editingId === cat.id ? (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className={inputClass}
                          placeholder="Category name"
                        />
                      </div>
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className={inputClass}
                        placeholder="Description (optional)"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Color:</span>
                        <div className="flex gap-1.5">
                          {CATEGORY_COLORS.map((c) => (
                            <button
                              key={c}
                              onClick={() => setEditColor(c)}
                              className={`h-6 w-6 rounded-full transition-transform ${editColor === c ? "ring-2 ring-offset-2 ring-blue-400 scale-110" : "hover:scale-110"}`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdate(cat.id)}
                          disabled={saving}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Check size={12} /> Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          <X size={12} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-4 w-4 rounded-full" style={{ backgroundColor: cat.color }} />
                        <div>
                          <p className={`text-sm font-medium ${cat.is_active ? "text-gray-700" : "text-gray-400"}`}>
                            {cat.name}
                            {!cat.is_active && <span className="ml-2 text-xs text-gray-400">(inactive)</span>}
                          </p>
                          {cat.description && (
                            <p className="text-xs text-gray-400">{cat.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleActive(cat.id, cat.is_active)}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                            cat.is_active
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          {cat.is_active ? "Active" : "Inactive"}
                        </button>
                        <button onClick={() => startEdit(cat)} className="text-gray-400 hover:text-gray-600">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(cat.id)} className="text-gray-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New category sidebar */}
      <div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">New Category</h2>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={inputClass}
              placeholder="Category name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className={inputClass}
              placeholder="Optional description"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Color</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`h-7 w-7 rounded-full transition-transform ${newColor === c ? "ring-2 ring-offset-2 ring-blue-400 scale-110" : "hover:scale-110"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || saving}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus size={14} /> {saving ? "Creating…" : "Create Category"}
          </button>
        </div>
      </div>
    </div>
  );
}
