"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRequirePermission } from "@/lib/usePermission";
import { UnitSelect } from "@/components/ui/unit-select";
import {
  MATERIAL_CATEGORIES,
  STORAGE_REQUIREMENTS,
  SHELF_LIFE_UNITS,
} from "@/lib/constants";

function NewMaterialForm() {
  const { loading: permLoading } = useRequirePermission("materials.create");
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetIngredientId = searchParams.get("ingredient_id") || "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [ingredientId, setIngredientId] = useState<string>(presetIngredientId);

  // ── Form state ──────────────────────────────────────────────
  // Identification
  const [name, setName] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [sku, setSku] = useState("");
  const [upc, setUpc] = useState("");
  const [gtin, setGtin] = useState("");
  const [vendorItemNumber, setVendorItemNumber] = useState("");
  const [specSheetNumber, setSpecSheetNumber] = useState("");

  // Classification
  const [supplierId, setSupplierId] = useState("");
  const [category, setCategory] = useState("Raw Material");
  const [itemType, setItemType] = useState("");
  const [brand, setBrand] = useState("");

  // Units & cost
  const [unit, setUnit] = useState("lbs");
  const [cost, setCost] = useState("");
  const [unitConversionFactor, setUnitConversionFactor] = useState("");

  // Inventory
  const [reorderPoint, setReorderPoint] = useState("0");
  const [currentStock, setCurrentStock] = useState("0");

  // Shelf life
  const [shelfLifeQty, setShelfLifeQty] = useState("");
  const [shelfLifeUnit, setShelfLifeUnit] = useState("");
  const [openedShelfLifeQty, setOpenedShelfLifeQty] = useState("");
  const [openedShelfLifeUnit, setOpenedShelfLifeUnit] = useState("");

  // Storage
  const [storageRequirements, setStorageRequirements] = useState("");

  // Packaging
  const [packagingSize, setPackagingSize] = useState("");
  const [innerPackSize, setInnerPackSize] = useState("");
  const [innerPackType, setInnerPackType] = useState("");
  const [outerPackType, setOuterPackType] = useState("");

  // Text fields
  const [ingredientsList, setIngredientsList] = useState("");
  const [nutritionalInfo, setNutritionalInfo] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const fetchOptions = async () => {
      const supabase = createClient();
      const [{ data: sup }, { data: ing }] = await Promise.all([
        supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
        supabase.from("ingredients").select("id, name, unit").eq("is_active", true).order("name"),
      ]);
      setSuppliers(sup || []);
      setIngredients(ing || []);
    };
    fetchOptions();
  }, []);

  // When the user picks an ingredient, default the material's unit
  // to the ingredient's unit (they can still override for vendor packaging).
  useEffect(() => {
    if (!ingredientId) return;
    const ing = ingredients.find((i) => i.id === ingredientId);
    if (ing?.unit) setUnit(ing.unit);
  }, [ingredientId, ingredients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("You must be logged in."); setLoading(false); return; }

    const { data: profile } = await supabase.from("users").select("org_id").eq("id", user.id).single();
    if (!profile) { setError("Could not find your organization."); setLoading(false); return; }

    if (!ingredientId) { setError("Please select an ingredient."); setLoading(false); return; }

    const { error: insertError } = await supabase.from("raw_materials").insert({
      org_id: profile.org_id,
      ingredient_id: ingredientId,
      name,
      vendor_name: vendorName || null,
      item_code: itemCode || null,
      sku: sku || null,
      upc: upc || null,
      gtin: gtin || null,
      vendor_item_number: vendorItemNumber || null,
      spec_sheet_number: specSheetNumber || null,
      supplier_id: supplierId || null,
      category,
      item_type: itemType || null,
      brand: brand || null,
      unit,
      cost: cost ? parseFloat(cost) : null,
      unit_conversion_factor: unitConversionFactor ? parseFloat(unitConversionFactor) : null,
      reorder_point: parseFloat(reorderPoint) || 0,
      current_stock: parseFloat(currentStock) || 0,
      shelf_life_qty: shelfLifeQty ? parseInt(shelfLifeQty) : null,
      shelf_life_unit: shelfLifeUnit || null,
      opened_shelf_life_qty: openedShelfLifeQty ? parseInt(openedShelfLifeQty) : null,
      opened_shelf_life_unit: openedShelfLifeUnit || null,
      storage_requirements: storageRequirements || null,
      packaging_size: packagingSize || null,
      inner_pack_size: innerPackSize || null,
      inner_pack_type: innerPackType || null,
      outer_pack_type: outerPackType || null,
      ingredients_list: ingredientsList || null,
      nutritional_info: nutritionalInfo || null,
      description: description || null,
      notes: notes || null,
    });

    setLoading(false);
    if (insertError) { setError(insertError.message); return; }

    router.push("/materials");
    router.refresh();
  };

  if (permLoading) return <div className="p-8 text-center text-sm text-gray-500">Checking permissions…</div>;

  const sectionClass = "rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4";
  const labelClass = "block text-sm font-medium text-gray-700";
  const inputClass = "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/materials" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={16} /> Back to Materials
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Add Raw Material</h1>
        <p className="text-sm text-gray-500">Add a new ingredient or raw material to your inventory</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {/* ── Identification ─────────────────────────── */}
        <div className={sectionClass}>
          <h2 className="text-lg font-semibold text-gray-900">Identification</h2>

          <div>
            <label htmlFor="ingredient" className={labelClass}>Ingredient *</label>
            <select id="ingredient" required value={ingredientId} onChange={(e) => setIngredientId(e.target.value)}
              className={inputClass}>
              <option value="">Select ingredient...</option>
              {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Allergens are inherited from the ingredient.{" "}
              <Link href="/ingredients/new" className="text-blue-600 hover:underline">Create a new ingredient</Link> if none fits.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className={labelClass}>Internal Name *</label>
              <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Your in-house name" className={inputClass} />
            </div>
            <div>
              <label htmlFor="vendorName" className={labelClass}>Vendor Product Name</label>
              <input id="vendorName" type="text" value={vendorName} onChange={(e) => setVendorName(e.target.value)}
                placeholder="Name on vendor catalog" className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="itemCode" className={labelClass}>Item Code</label>
              <input id="itemCode" type="text" value={itemCode} onChange={(e) => setItemCode(e.target.value)}
                placeholder="e.g. RM10001" className={inputClass} />
            </div>
            <div>
              <label htmlFor="sku" className={labelClass}>SKU</label>
              <input id="sku" type="text" value={sku} onChange={(e) => setSku(e.target.value)}
                className={inputClass} />
            </div>
            <div>
              <label htmlFor="vendorItemNumber" className={labelClass}>Vendor Item #</label>
              <input id="vendorItemNumber" type="text" value={vendorItemNumber} onChange={(e) => setVendorItemNumber(e.target.value)}
                placeholder="Ordering number" className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="upc" className={labelClass}>UPC</label>
              <input id="upc" type="text" value={upc} onChange={(e) => setUpc(e.target.value)}
                className={inputClass} />
            </div>
            <div>
              <label htmlFor="gtin" className={labelClass}>GTIN</label>
              <input id="gtin" type="text" value={gtin} onChange={(e) => setGtin(e.target.value)}
                className={inputClass} />
            </div>
            <div>
              <label htmlFor="specSheetNumber" className={labelClass}>Spec Sheet #</label>
              <input id="specSheetNumber" type="text" value={specSheetNumber} onChange={(e) => setSpecSheetNumber(e.target.value)}
                className={inputClass} />
            </div>
          </div>
        </div>

        {/* ── Classification & Vendor ────────────────── */}
        <div className={sectionClass}>
          <h2 className="text-lg font-semibold text-gray-900">Classification</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="supplier" className={labelClass}>Vendor *</label>
              <select id="supplier" required value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
                className={inputClass}>
                <option value="">Select vendor...</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="category" className={labelClass}>Category</label>
              <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}
                className={inputClass}>
                {MATERIAL_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="itemType" className={labelClass}>Item Type</label>
              <input id="itemType" type="text" value={itemType} onChange={(e) => setItemType(e.target.value)}
                placeholder="e.g. Flour, Sugar, Butter" className={inputClass} />
            </div>
            <div>
              <label htmlFor="brand" className={labelClass}>Brand</label>
              <input id="brand" type="text" value={brand} onChange={(e) => setBrand(e.target.value)}
                placeholder="Brand or variant name" className={inputClass} />
            </div>
          </div>
        </div>

        {/* ── Units, Cost & Inventory ────────────────── */}
        <div className={sectionClass}>
          <h2 className="text-lg font-semibold text-gray-900">Units, Cost &amp; Inventory</h2>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="unit" className={labelClass}>Unit of Measure *</label>
              <UnitSelect id="unit" value={unit} onChange={setUnit} required showPlaceholder={false}
                className={inputClass} />
            </div>
            <div>
              <label htmlFor="cost" className={labelClass}>Cost per Unit ($)</label>
              <input id="cost" type="number" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)}
                placeholder="0.00" className={inputClass} />
            </div>
            <div>
              <label htmlFor="unitConversionFactor" className={labelClass}>Unit Conversion Factor</label>
              <input id="unitConversionFactor" type="number" step="0.0001" min="0" value={unitConversionFactor}
                onChange={(e) => setUnitConversionFactor(e.target.value)}
                placeholder="Order → usage" className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="currentStock" className={labelClass}>Current Stock</label>
              <input id="currentStock" type="number" step="0.01" min="0" value={currentStock}
                onChange={(e) => setCurrentStock(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="reorderPoint" className={labelClass}>Reorder Point</label>
              <input id="reorderPoint" type="number" step="0.01" min="0" value={reorderPoint}
                onChange={(e) => setReorderPoint(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>

        {/* ── Shelf Life ─────────────────────────────── */}
        <div className={sectionClass}>
          <h2 className="text-lg font-semibold text-gray-900">Shelf Life</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="shelfLifeQty" className={labelClass}>Unopened</label>
                <input id="shelfLifeQty" type="number" min="0" value={shelfLifeQty}
                  onChange={(e) => setShelfLifeQty(e.target.value)} placeholder="e.g. 18" className={inputClass} />
              </div>
              <div>
                <label htmlFor="shelfLifeUnit" className={labelClass}>&nbsp;</label>
                <select id="shelfLifeUnit" value={shelfLifeUnit} onChange={(e) => setShelfLifeUnit(e.target.value)}
                  className={inputClass}>
                  <option value="">Unit...</option>
                  {SHELF_LIFE_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="openedShelfLifeQty" className={labelClass}>After Opening</label>
                <input id="openedShelfLifeQty" type="number" min="0" value={openedShelfLifeQty}
                  onChange={(e) => setOpenedShelfLifeQty(e.target.value)} placeholder="e.g. 7" className={inputClass} />
              </div>
              <div>
                <label htmlFor="openedShelfLifeUnit" className={labelClass}>&nbsp;</label>
                <select id="openedShelfLifeUnit" value={openedShelfLifeUnit}
                  onChange={(e) => setOpenedShelfLifeUnit(e.target.value)} className={inputClass}>
                  <option value="">Unit...</option>
                  {SHELF_LIFE_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── Storage ─────────────────────── */}
        <div className={sectionClass}>
          <h2 className="text-lg font-semibold text-gray-900">Storage</h2>

          <div>
            <label htmlFor="storageRequirements" className={labelClass}>Storage Requirements</label>
            <select id="storageRequirements" value={storageRequirements}
              onChange={(e) => setStorageRequirements(e.target.value)} className={inputClass}>
              <option value="">Select...</option>
              {STORAGE_REQUIREMENTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <p className="mt-1 text-xs text-gray-500">Allergens come from the parent ingredient — edit them on the ingredient.</p>
          </div>
        </div>

        {/* ── Packaging ──────────────────────────────── */}
        <div className={sectionClass}>
          <h2 className="text-lg font-semibold text-gray-900">Packaging</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="packagingSize" className={labelClass}>Package Size</label>
              <input id="packagingSize" type="text" value={packagingSize}
                onChange={(e) => setPackagingSize(e.target.value)} placeholder="e.g. 50 lb, 1 gal" className={inputClass} />
            </div>
            <div>
              <label htmlFor="innerPackSize" className={labelClass}>Inner Pack Size</label>
              <input id="innerPackSize" type="text" value={innerPackSize}
                onChange={(e) => setInnerPackSize(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="innerPackType" className={labelClass}>Inner Pack Type</label>
              <input id="innerPackType" type="text" value={innerPackType}
                onChange={(e) => setInnerPackType(e.target.value)} placeholder="bag, box, pouch" className={inputClass} />
            </div>
            <div>
              <label htmlFor="outerPackType" className={labelClass}>Outer Pack Type</label>
              <input id="outerPackType" type="text" value={outerPackType}
                onChange={(e) => setOuterPackType(e.target.value)} placeholder="case, pallet" className={inputClass} />
            </div>
          </div>
        </div>

        {/* ── Composition & Notes ─────────────────────── */}
        <div className={sectionClass}>
          <h2 className="text-lg font-semibold text-gray-900">Composition &amp; Notes</h2>

          <div>
            <label htmlFor="ingredientsList" className={labelClass}>Ingredients List</label>
            <textarea id="ingredientsList" rows={3} value={ingredientsList}
              onChange={(e) => setIngredientsList(e.target.value)}
              placeholder="Paste ingredient list from spec sheet" className={inputClass} />
          </div>

          <div>
            <label htmlFor="nutritionalInfo" className={labelClass}>Nutritional Info</label>
            <textarea id="nutritionalInfo" rows={3} value={nutritionalInfo}
              onChange={(e) => setNutritionalInfo(e.target.value)}
              placeholder="Paste nutrition facts from spec sheet" className={inputClass} />
          </div>

          <div>
            <label htmlFor="description" className={labelClass}>Description</label>
            <textarea id="description" rows={2} value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="General description of this material" className={inputClass} />
          </div>

          <div>
            <label htmlFor="notes" className={labelClass}>Notes</label>
            <textarea id="notes" rows={2} value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes, comments, special instructions" className={inputClass} />
          </div>
        </div>

        {/* ── Actions ────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/materials" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</Link>
          <button type="submit" disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Creating..." : "Add Material"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewMaterialPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-gray-500">Loading…</div>}>
      <NewMaterialForm />
    </Suspense>
  );
}
