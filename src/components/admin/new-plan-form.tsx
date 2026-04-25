"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ModuleOption {
  slug: string;
  name: string;
  is_core: boolean;
  price_monthly: number | null;
}

interface Props {
  modules: ModuleOption[];
}

export function NewPlanForm({ modules }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    price_monthly: "",
    price_yearly: "",
    max_users: "",
    max_batches_per_month: "",
    is_featured: false,
    badge: "",
    sort_order: "0",
  });

  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const coreModules = modules.filter((m) => m.is_core);
  const nonCoreModules = modules.filter((m) => !m.is_core);

  const toggleModule = (slug: string) => {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const allIncluded = [
      ...coreModules.map((m) => m.slug),
      ...Array.from(selectedModules),
    ];

    const res = await fetch("/api/admin/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description || null,
        price_monthly: parseFloat(form.price_monthly) || 0,
        price_yearly: form.price_yearly ? parseFloat(form.price_yearly) : null,
        max_users: form.max_users ? parseInt(form.max_users) : null,
        max_batches_per_month: form.max_batches_per_month ? parseInt(form.max_batches_per_month) : null,
        included_modules: allIncluded,
        is_featured: form.is_featured,
        badge: form.badge || null,
        sort_order: parseInt(form.sort_order) || 0,
      }),
    });

    if (res.ok) {
      router.push("/admin/plans");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create plan");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Plan Name *</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="e.g. Starter, Professional"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Badge</label>
          <input
            value={form.badge}
            onChange={(e) => setForm({ ...form, badge: e.target.value })}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="e.g. Most Popular"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Monthly ($) *</label>
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={form.price_monthly}
            onChange={(e) => setForm({ ...form, price_monthly: e.target.value })}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Yearly ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.price_yearly}
            onChange={(e) => setForm({ ...form, price_yearly: e.target.value })}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Max Users</label>
          <input
            type="number"
            min="1"
            value={form.max_users}
            onChange={(e) => setForm({ ...form, max_users: e.target.value })}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="∞"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Max Batches/mo</label>
          <input
            type="number"
            min="1"
            value={form.max_batches_per_month}
            onChange={(e) => setForm({ ...form, max_batches_per_month: e.target.value })}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="∞"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_featured}
            onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
            className="rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-300">Featured</span>
        </label>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Sort Order:</label>
          <input
            type="number"
            value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
            className="w-16 rounded-lg border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-white text-center focus:border-blue-500"
          />
        </div>
      </div>

      {/* Modules */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Included Modules</label>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {coreModules.map((mod) => (
              <span
                key={mod.slug}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-800 bg-blue-900/30 px-3 py-1.5 text-xs text-blue-400"
              >
                {mod.name} <span className="text-[10px] text-blue-600">(core)</span>
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {nonCoreModules.map((mod) => (
              <label
                key={mod.slug}
                className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                  selectedModules.has(mod.slug)
                    ? "border-green-700 bg-green-900/20"
                    : "border-gray-700 hover:border-gray-600"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedModules.has(mod.slug)}
                  onChange={() => toggleModule(mod.slug)}
                  className="rounded border-gray-600 bg-gray-800 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-300">{mod.name}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-400">{error}</div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Creating…" : "Create Plan"}
      </button>
    </form>
  );
}
