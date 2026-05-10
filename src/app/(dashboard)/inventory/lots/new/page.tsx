"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Material = {
  id: string;
  name: string;
  unit: string;
  ingredients: { name: string } | null;
  suppliers: { name: string } | null;
};

function genBarcode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `LOT-${s}`;
}

export default function NewLotPage() {
  const router = useRouter();
  const supabase = createClient();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    material_id: "",
    lot_number: "",
    barcode: "",
    quantity: "",
    expiry_date: "",
    supplier_lot_number: "",
    notes: "",
  });

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("raw_materials")
        .select("id, name, unit, ingredients(name), suppliers(name)")
        .eq("is_active", true)
        .order("name");
      setMaterials(((data ?? []) as unknown) as Material[]);
      setLoading(false);
    }
    load();
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { data: userResp } = await supabase.auth.getUser();
    const user = userResp?.user;
    if (!user) {
      setError("Not authenticated");
      setSaving(false);
      return;
    }
    const { data: profile } = await supabase
      .from("users")
      .select("org_id")
      .eq("id", user.id)
      .single();
    if (!profile?.org_id) {
      setError("No org");
      setSaving(false);
      return;
    }

    const barcode = form.barcode.trim() || genBarcode();
    const qty = Number(form.quantity);
    if (!form.material_id || !form.lot_number || !(qty > 0)) {
      setError("Material, lot number, and a positive quantity are required.");
      setSaving(false);
      return;
    }

    const { data, error: insErr } = await supabase
      .from("material_lots")
      .insert({
        org_id: profile.org_id,
        material_id: form.material_id,
        lot_number: form.lot_number,
        barcode,
        quantity: qty,
        quantity_remaining: qty,
        expiry_date: form.expiry_date || null,
        supplier_lot_number: form.supplier_lot_number || null,
        notes: form.notes || null,
      })
      .select("id")
      .single();

    if (insErr) {
      setError(insErr.message);
      setSaving(false);
      return;
    }

    router.push(`/inventory/lots/${data!.id}`);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/inventory/stock" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-3">
          <ArrowLeft size={16} /> Back to Stock
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Receive Lot</h1>
        <p className="text-sm text-gray-500">Record a new incoming material lot.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={onSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700">Material *</label>
          <select
            required
            value={form.material_id}
            onChange={(e) => setForm({ ...form, material_id: e.target.value })}
            disabled={loading}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">{loading ? "Loading…" : "Select a material"}</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.ingredients?.name ? ` — ${m.ingredients.name}` : ""}
                {m.suppliers?.name ? ` (${m.suppliers.name})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Lot Number *</label>
            <input
              required
              value={form.lot_number}
              onChange={(e) => setForm({ ...form, lot_number: e.target.value })}
              placeholder="e.g., BT-2260-A"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Quantity *</label>
            <input
              required
              type="number"
              step="0.01"
              min="0"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Barcode</label>
          <input
            value={form.barcode}
            onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            placeholder="Scan vendor barcode or leave blank to auto-generate"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          />
          <p className="mt-1 text-xs text-gray-500">If blank, we generate a code starting with LOT-…</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Expiry Date</label>
            <input
              type="date"
              value={form.expiry_date}
              onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Supplier Lot #</label>
            <input
              value={form.supplier_lot_number}
              onChange={(e) => setForm({ ...form, supplier_lot_number: e.target.value })}
              placeholder="From the vendor's COA / packing slip"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/inventory/stock"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Lot"}
          </button>
        </div>
      </form>
    </div>
  );
}
