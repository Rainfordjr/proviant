"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Trash2, Check, X, GripVertical } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRequirePermission } from "@/lib/usePermission";

interface Category {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  product_count?: number;
}

export default function ProductCategoriesPage() {
  const { loading: permLoading } = useRequirePermission("products.view");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New category form
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [adding, setAdding] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchCategories = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("product_categories")
      .select("*, products(id)")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (data) {
      setCategories(
        data.map((c: any) => ({
          ...c,
          product_count: (c.products || []).length,
          products: undefined,
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("You must be logged in."); setAdding(false); return; }

    const { data: profile } = await supabase.from("users").select("org_id").eq("id", user.id).single();
    if (!profile) { setError("Could not find your organization."); setAdding(false); return; }

    const maxSort = categories.length > 0 ? Math.max(...categories.map((c) => c.sort_order)) + 1 : 0;

    const { error: insertError } = await supabase.from("product_categories").insert({
      org_id: profile.org_id,
      name: newName.trim(),
      description: newDescription.trim() || null,
      sort_order: maxSort,
    });

    setAdding(false);
    if (insertError) {
      setError(insertError.message.includes("unique") ? "A category with that name already exists." : insertError.message);
      return;
    }

    setNewName("");
    setNewDescription("");
    setShowAdd(false);
    fetchCategories();
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDescription(cat.description || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
  };

  const handleSave = async () => {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("product_categories")
      .update({
        name: editName.trim(),
        description: editDescription.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingId);

    setSaving(false);
    if (updateError) {
      setError(updateError.message.includes("unique") ? "A category with that name already exists." : updateError.message);
      return;
    }

    cancelEdit();
    fetchCategories();
  };

  const handleToggleActive = async (cat: Category) => {
    const supabase = createClient();
    await supabase
      .from("product_categories")
      .update({ is_active: !cat.is_active, updated_at: new Date().toISOString() })
      .eq("id", cat.id);
    fetchCategories();
  };

  const handleDelete = async (cat: Category) => {
    if (cat.product_count && cat.product_count > 0) {
      setError(`Cannot delete "${cat.name}" — it has ${cat.product_count} product(s) assigned. Deactivate it instead.`);
      return;
    }
    if (!confirm(`Delete category "${cat.name}"? This cannot be undone.`)) return;

    const supabase = createClient();
    const { error: deleteError } = await supabase.from("product_categories").delete().eq("id", cat.id);
    if (deleteError) { setError(deleteError.message); return; }
    fetchCategories();
  };

  if (permLoading || loading) return <div className="p-8 text-center text-sm text-gray-500">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/products" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={16} /> Back to Products
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Product Categories</h1>
            <p className="text-sm text-gray-500">Organize your products into categories</p>
          </div>
          {!showAdd && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Plus size={16} /> Add Category
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}

      {/* Add category form */}
      {showAdd && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-blue-900">New Category</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name *</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Bread, Pastry, Frozen"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setShowAdd(false); }}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <input type="text" value={newDescription} onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional description"
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setShowAdd(false); }}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={adding || !newName.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {adding ? "Adding..." : "Add Category"}
            </button>
            <button onClick={() => { setShowAdd(false); setNewName(""); setNewDescription(""); }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Categories list */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-8"></th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Category</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Description</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Products</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.map((cat) => (
              <tr key={cat.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-gray-300">
                  <GripVertical size={16} />
                </td>
                <td className="px-6 py-4">
                  {editingId === cat.id ? (
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") cancelEdit(); }}
                      className="block w-full rounded border border-blue-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  ) : (
                    <span className="text-sm font-medium text-gray-900">{cat.name}</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingId === cat.id ? (
                    <input type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") cancelEdit(); }}
                      className="block w-full rounded border border-blue-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  ) : (
                    <span className="text-sm text-gray-500">{cat.description || "—"}</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{cat.product_count}</td>
                <td className="px-6 py-4">
                  <button onClick={() => handleToggleActive(cat)}
                    title={`Click to ${cat.is_active ? "deactivate" : "activate"}`}>
                    {cat.is_active ? (
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 hover:bg-green-200 transition-colors cursor-pointer">Active</span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer">Inactive</span>
                    )}
                  </button>
                </td>
                <td className="px-6 py-4 text-right">
                  {editingId === cat.id ? (
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={handleSave} disabled={saving}
                        className="rounded p-1.5 text-green-600 hover:bg-green-50"><Check size={16} /></button>
                      <button onClick={cancelEdit}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => startEdit(cat)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600"><Pencil size={16} /></button>
                      <button onClick={() => handleDelete(cat)}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={16} /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                  No categories yet. Add your first category to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
