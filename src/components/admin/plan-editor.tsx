"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Plan } from "@/types/database";

interface ModuleOption {
  slug: string;
  name: string;
  is_core: boolean;
  price_monthly: number | null;
}

interface Props {
  plan: Plan;
  modules: ModuleOption[];
}

export function PlanEditor({ plan, modules }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: plan.name,
    description: plan.description || "",
    price_monthly: plan.price_monthly.toString(),
    price_yearly: plan.price_yearly?.toString() || "",
    max_users: plan.max_users?.toString() || "",
    max_batches_per_month: plan.max_batches_per_month?.toString() || "",
    is_active: plan.is_active,
    is_featured: plan.is_featured,
    badge: plan.badge || "",
    sort_order: plan.sort_order.toString(),
  });

  const [selectedModules, setSelectedModules] = useState<Set<string>>(
    new Set(plan.included_modules || [])
  );
  const [changeNotes, setChangeNotes] = useState("");

  const toggleModule = (slug: string) => {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  // Core modules are always included
  const coreModules = modules.filter((m) => m.is_core);
  const nonCoreModules = modules.filter((m) => !m.is_core);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    // Include core module slugs automatically
    const allIncluded = [
      ...coreModules.map((m) => m.slug),
      ...Array.from(selectedModules).filter((s) => !coreModules.some((c) => c.slug === s)),
    ];

    const res = await fetch("/api/admin/plans", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: plan.id,
        name: form.name,
        description: form.description || null,
        price_monthly: parseFloat(form.price_monthly) || 0,
        price_yearly: form.price_yearly ? parseFloat(form.price_yearly) : null,
        max_users: form.max_users ? parseInt(form.max_users) : null,
        max_batches_per_month: form.max_batches_per_month ? parseInt(form.max_batches_per_month) : null,
        included_modules: allIncluded,
        is_active: form.is_active,
        is_featured: form.is_featured,
        badge: form.badge || null,
        sort_order: parseInt(form.sort_order) || 0,
        change_notes: changeNotes || null,
      }),
    });

    setSaving(false);

    if (res.ok) {
      setSaved(true);
      setChangeNotes("");
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to save");
    }
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-5">
      <h2 className="text-lg font-semibold text-white">Edit Plan</h2>

      {/* Name & description */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Plan Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Badge</label>
          <input
            value={form.badge}
            onChange={(e) => setForm({ ...form, badge: e.target.value })}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="e.g. Most Popular, Best Value"
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

      {/* Pricing */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Monthly ($)</label>
          <input
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
            placeholder="Optional"
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
            placeholder="Unlimited"
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
            placeholder="Unlimited"
          />
        </div>
      </div>

      {/* Flags */}
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-300">Active</span>
        </label>
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

      {/* Included Modules */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Included Modules</label>
        <div className="space-y-2">
          {/* Core modules — always included, shown but not toggleable */}
          <div className="flex flex-wrap gap-2">
            {coreModules.map((mod) => (
              <span
                key={mod.slug}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-800 bg-blue-900/30 px-3 py-1.5 text-xs text-blue-400"
              >
                {mod.name}
                <span className="text-[10px] text-blue-600">(core)</span>
              </span>
            ))}
          </div>

          {/* Non-core modules — toggleable */}
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
                <div>
                  <span className="text-sm text-gray-300">{mod.name}</span>
                  {mod.price_monthly && (
                    <span className="block text-[10px] text-gray-500">
                      ${Number(mod.price_monthly).toFixed(2)}/mo as add-on
                    </span>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Change notes */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Change Notes <span className="text-gray-600">(what changed in this update?)</span>
        </label>
        <input
          value={changeNotes}
          onChange={(e) => setChangeNotes(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="e.g. Increased batch limit, added Analytics module"
        />
      </div>

      {/* Save */}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save & Create New Version"}
        </button>
        {saved && (
          <span className="text-sm text-green-400">Version saved successfully</span>
        )}
      </div>
    </div>
  );
}
