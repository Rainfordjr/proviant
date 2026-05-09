"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle, XCircle, Pencil, Check, X,
  Thermometer, AlertTriangle, Package, DollarSign, Clock, Warehouse,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRequirePermission } from "@/lib/usePermission";
import { UnitSelect } from "@/components/ui/unit-select";
import {
  ALLERGENS,
  MATERIAL_CATEGORIES,
  STORAGE_REQUIREMENTS,
  SHELF_LIFE_UNITS,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";

// ── Inline-editable field components ─────────────────────────

function InlineText({
  label, value, field, onSave, type = "text", placeholder,
}: {
  label: string; value: string; field: string;
  onSave: (field: string, value: string | null) => Promise<void>;
  type?: string; placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave(field, draft || null);
    setSaving(false);
    setEditing(false);
  };

  const cancel = () => { setDraft(value); setEditing(false); };

  if (!editing) {
    return (
      <div className="group">
        <dt className="text-xs font-medium uppercase text-gray-400">{label}</dt>
        <dd
          className="text-sm font-medium text-gray-900 cursor-pointer rounded px-1 -mx-1 py-0.5 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-1"
          onClick={() => setEditing(true)}
          title="Click to edit"
        >
          {value || <span className="text-gray-300 italic">—</span>}
          <Pencil size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
        </dd>
      </div>
    );
  }

  return (
    <div>
      <dt className="text-xs font-medium uppercase text-blue-500">{label}</dt>
      <dd className="flex items-center gap-1 mt-0.5">
        <input
          autoFocus
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          placeholder={placeholder}
          className="block w-full rounded border border-blue-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button onClick={save} disabled={saving} className="rounded p-1 text-green-600 hover:bg-green-50" title="Save">
          <Check size={14} />
        </button>
        <button onClick={cancel} className="rounded p-1 text-gray-400 hover:bg-gray-100" title="Cancel">
          <X size={14} />
        </button>
      </dd>
    </div>
  );
}

function InlineSelect({
  label, value, field, options, onSave, placeholder = "Select...",
}: {
  label: string; value: string; field: string;
  options: { value: string; label: string }[];
  onSave: (field: string, value: string | null) => Promise<void>;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const displayLabel = options.find((o) => o.value === value)?.label || value;

  const save = async () => {
    setSaving(true);
    await onSave(field, draft || null);
    setSaving(false);
    setEditing(false);
  };

  const cancel = () => { setDraft(value); setEditing(false); };

  if (!editing) {
    return (
      <div className="group">
        <dt className="text-xs font-medium uppercase text-gray-400">{label}</dt>
        <dd
          className="text-sm font-medium text-gray-900 cursor-pointer rounded px-1 -mx-1 py-0.5 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-1"
          onClick={() => setEditing(true)}
          title="Click to edit"
        >
          {displayLabel || <span className="text-gray-300 italic">—</span>}
          <Pencil size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
        </dd>
      </div>
    );
  }

  return (
    <div>
      <dt className="text-xs font-medium uppercase text-blue-500">{label}</dt>
      <dd className="flex items-center gap-1 mt-0.5">
        <select autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") cancel(); }}
          className="block w-full rounded border border-blue-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
          <option value="">{placeholder}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={save} disabled={saving} className="rounded p-1 text-green-600 hover:bg-green-50"><Check size={14} /></button>
        <button onClick={cancel} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X size={14} /></button>
      </dd>
    </div>
  );
}

function InlineTextarea({
  label, value, field, onSave, placeholder, rows = 3,
}: {
  label: string; value: string; field: string;
  onSave: (field: string, value: string | null) => Promise<void>;
  placeholder?: string; rows?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave(field, draft || null);
    setSaving(false);
    setEditing(false);
  };

  const cancel = () => { setDraft(value); setEditing(false); };

  if (!editing) {
    return (
      <div className="group">
        <h3 className="text-sm font-semibold text-gray-700">{label}</h3>
        <div
          className="text-sm text-gray-700 whitespace-pre-wrap cursor-pointer rounded px-1 -mx-1 py-0.5 hover:bg-blue-50 transition-colors mt-1 flex items-start gap-1"
          onClick={() => setEditing(true)}
          title="Click to edit"
        >
          {value || <span className="text-gray-300 italic">Empty — click to add</span>}
          <Pencil size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-blue-600">{label}</h3>
      <textarea autoFocus rows={rows} value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") cancel(); }}
        placeholder={placeholder}
        className="mt-1 block w-full rounded border border-blue-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
      <div className="flex gap-1 mt-1">
        <button onClick={save} disabled={saving}
          className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Saving..." : "Save"}
        </button>
        <button onClick={cancel} className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main page component ──────────────────────────────────────

export default function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { loading: permLoading } = useRequirePermission("materials.view");
  const router = useRouter();
  const [mat, setMat] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [materialId, setMaterialId] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { id } = await params;
      setMaterialId(id);
      const supabase = createClient();
      const [{ data }, { data: suppData }] = await Promise.all([
        supabase.from("raw_materials").select("*, suppliers(id, name), ingredients(id, name, unit, allergens)").eq("id", id).single(),
        supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
      ]);
      setMat(data);
      setSuppliers(suppData || []);
      setFetching(false);
    };
    load();
  }, [params]);

  // Save a single field to the database
  const saveField = useCallback(async (field: string, value: any) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("raw_materials")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("id", materialId);

    if (error) {
      setSaveMsg(`Error: ${error.message}`);
      setTimeout(() => setSaveMsg(null), 3000);
      return;
    }

    // Refresh the material data
    const { data } = await supabase
      .from("raw_materials")
      .select("*, suppliers(id, name), ingredients(id, name, unit, allergens)")
      .eq("id", materialId)
      .single();
    setMat(data);
    setSaveMsg("Saved");
    setTimeout(() => setSaveMsg(null), 2000);
    router.refresh();
  }, [materialId, router]);

  // Save numeric fields with parsing
  const saveNumeric = useCallback(async (field: string, value: string | null) => {
    await saveField(field, value ? parseFloat(value) : null);
  }, [saveField]);

  const saveInt = useCallback(async (field: string, value: string | null) => {
    await saveField(field, value ? parseInt(value) : null);
  }, [saveField]);

  if (permLoading || fetching) return <div className="p-8 text-center text-sm text-gray-500">Loading…</div>;
  if (!mat) return <div className="p-8 text-center text-sm text-gray-500">Material not found.</div>;

  const allergenLabels = (mat.ingredients?.allergens || []).map((key: string) => {
    const found = ALLERGENS.find((a) => a.value === key);
    return found ? found.label : key;
  });

  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.name }));

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────── */}
      <div>
        <Link href="/materials" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={16} /> Back to Materials
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <InlineText label="" value={mat.name} field="name"
              onSave={saveField}
              placeholder="Material name" />
            {/* Render as a styled heading when not editing */}
          </div>
          <div className="flex items-center gap-3">
            {saveMsg && (
              <span className={`text-xs font-medium px-2 py-1 rounded ${saveMsg === "Saved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {saveMsg}
              </span>
            )}
            <button
              onClick={() => saveField("is_active", !mat.is_active)}
              className="cursor-pointer"
              title={`Click to mark ${mat.is_active ? "inactive" : "active"}`}
            >
              {mat.is_active ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors">
                  <CheckCircle size={14} /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-500 hover:bg-gray-200 transition-colors">
                  <XCircle size={14} /> Inactive
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Quick info cards ───────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Warehouse size={16} /> <span className="text-xs font-medium uppercase">Vendor</span>
          </div>
          <InlineSelect label="" value={mat.supplier_id || ""} field="supplier_id"
            options={supplierOptions} onSave={saveField} placeholder="Select vendor..." />
          {mat.suppliers?.name && (
            <Link href={`/vendors/${mat.suppliers.id}`} className="text-xs text-blue-500 hover:text-blue-700 mt-1 inline-block">
              View vendor →
            </Link>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Package size={16} /> <span className="text-xs font-medium uppercase">Stock</span>
          </div>
          <InlineText label="" value={String(mat.current_stock ?? 0)} field="current_stock"
            onSave={saveNumeric} type="number" />
          <div className="mt-1">
            <span className="text-xs text-gray-400">Reorder at </span>
            <InlineText label="" value={String(mat.reorder_point ?? 0)} field="reorder_point"
              onSave={saveNumeric} type="number" />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <DollarSign size={16} /> <span className="text-xs font-medium uppercase">Cost</span>
          </div>
          <InlineText label="" value={mat.cost != null ? String(mat.cost) : ""} field="cost"
            onSave={saveNumeric} type="number" placeholder="0.00" />
          <InlineSelect label="" value={mat.unit || ""} field="unit"
            options={[
              { value: "lbs", label: "lbs" }, { value: "oz", label: "oz" }, { value: "kg", label: "kg" },
              { value: "g", label: "g" }, { value: "gallons", label: "gal" }, { value: "liters", label: "L" },
              { value: "each", label: "each" }, { value: "dozen", label: "doz" }, { value: "cases", label: "cases" },
            ]}
            onSave={saveField} />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Thermometer size={16} /> <span className="text-xs font-medium uppercase">Storage</span>
          </div>
          <InlineSelect label="" value={mat.storage_requirements || ""} field="storage_requirements"
            options={STORAGE_REQUIREMENTS.map((s) => ({ value: s.value, label: s.label }))}
            onSave={saveField} placeholder="Select..." />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Clock size={16} /> <span className="text-xs font-medium uppercase">Shelf Life</span>
          </div>
          <div className="flex items-center gap-1">
            <InlineText label="" value={mat.shelf_life_qty != null ? String(mat.shelf_life_qty) : ""} field="shelf_life_qty"
              onSave={saveInt} type="number" placeholder="—" />
            <InlineSelect label="" value={mat.shelf_life_unit || ""} field="shelf_life_unit"
              options={SHELF_LIFE_UNITS.map((u) => ({ value: u.value, label: u.label }))}
              onSave={saveField} />
          </div>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs text-gray-400 shrink-0">Opened:</span>
            <InlineText label="" value={mat.opened_shelf_life_qty != null ? String(mat.opened_shelf_life_qty) : ""} field="opened_shelf_life_qty"
              onSave={saveInt} type="number" placeholder="—" />
            <InlineSelect label="" value={mat.opened_shelf_life_unit || ""} field="opened_shelf_life_unit"
              options={SHELF_LIFE_UNITS.map((u) => ({ value: u.value, label: u.label }))}
              onSave={saveField} />
          </div>
        </div>
      </div>

      {/* ── Ingredient (with inherited allergens) ─── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Ingredient</h2>
          {mat.ingredients?.id && (
            <Link href={`/ingredients/${mat.ingredients.id}`}
              className="text-xs font-medium text-blue-600 hover:text-blue-800">
              View ingredient →
            </Link>
          )}
        </div>
        {mat.ingredients ? (
          <div className="space-y-2">
            <p className="text-base font-medium text-gray-900">{mat.ingredients.name}</p>
            <p className="text-xs text-gray-500">Recipe unit: {mat.ingredients.unit}</p>
            <div className="pt-2">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">Allergens (inherited)</p>
              {allergenLabels.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {allergenLabels.map((label: string) => (
                    <span key={label} className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
                      {label}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-gray-400">None</span>
              )}
              <p className="mt-1.5 text-xs text-gray-500">
                Allergens come from the parent ingredient and apply to every material under it.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">Not linked to an ingredient.</p>
        )}
      </div>

      {/* ── Identification ─────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Identification</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <InlineText label="Vendor Product Name" value={mat.vendor_name || ""} field="vendor_name" onSave={saveField} placeholder="Vendor's name for this product" />
          <InlineText label="Item Code" value={mat.item_code || ""} field="item_code" onSave={saveField} placeholder="e.g. RM10001" />
          <InlineText label="SKU" value={mat.sku || ""} field="sku" onSave={saveField} />
          <InlineText label="UPC" value={mat.upc || ""} field="upc" onSave={saveField} />
          <InlineText label="GTIN" value={mat.gtin || ""} field="gtin" onSave={saveField} />
          <InlineText label="Vendor Item #" value={mat.vendor_item_number || ""} field="vendor_item_number" onSave={saveField} />
          <InlineText label="Spec Sheet #" value={mat.spec_sheet_number || ""} field="spec_sheet_number" onSave={saveField} />
          <InlineSelect label="Category" value={mat.category || ""} field="category"
            options={MATERIAL_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
            onSave={saveField} />
          <InlineText label="Item Type" value={mat.item_type || ""} field="item_type" onSave={saveField} placeholder="e.g. Flour, Sugar" />
          <InlineText label="Brand" value={mat.brand || ""} field="brand" onSave={saveField} />
          <InlineText label="Unit Conversion Factor" value={mat.unit_conversion_factor != null ? String(mat.unit_conversion_factor) : ""} field="unit_conversion_factor" onSave={saveNumeric} type="number" />
        </dl>
      </div>

      {/* ── Packaging ──────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Packaging</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <InlineText label="Package Size" value={mat.packaging_size || ""} field="packaging_size" onSave={saveField} placeholder="e.g. 50 lb" />
          <InlineText label="Inner Pack Size" value={mat.inner_pack_size || ""} field="inner_pack_size" onSave={saveField} />
          <InlineText label="Inner Pack Type" value={mat.inner_pack_type || ""} field="inner_pack_type" onSave={saveField} placeholder="bag, box, pouch" />
          <InlineText label="Outer Pack Type" value={mat.outer_pack_type || ""} field="outer_pack_type" onSave={saveField} placeholder="case, pallet" />
        </dl>
      </div>

      {/* ── Composition & Notes ────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <InlineTextarea label="Ingredients List" value={mat.ingredients_list || ""} field="ingredients_list"
            onSave={saveField} placeholder="Paste ingredient list from spec sheet" />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <InlineTextarea label="Nutritional Info" value={mat.nutritional_info || ""} field="nutritional_info"
            onSave={saveField} placeholder="Paste nutrition facts from spec sheet" />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <InlineTextarea label="Description" value={mat.description || ""} field="description"
          onSave={saveField} placeholder="General description" rows={2} />
        <InlineTextarea label="Notes" value={mat.notes || ""} field="notes"
          onSave={saveField} placeholder="Internal notes, comments" rows={2} />
      </div>

      <div className="text-xs text-gray-400">
        Created {formatDate(mat.created_at)} · Last updated {formatDate(mat.updated_at)}
      </div>
    </div>
  );
}

