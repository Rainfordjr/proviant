// Shared data-loading for the batch consumption editors.
// Used by /(dashboard)/batches/[id] AND /production/batches/[id].

import type { SupabaseClient } from "@supabase/supabase-js";

export type ScannerLine = {
  rvi_id: string;
  ingredient_id: string;
  ingredient_name: string;
  required_qty: number;
  unit: string;
  consumed_qty: number;
};

export type BulkLotOption = {
  id: string;
  lot_number: string;
  raw_material_id: string;
  raw_material_name: string;
  quantity_remaining: number;
  unit: string;
  expiry_date: string | null;
};

export type BatchConsumptionContext = {
  scannerLines: ScannerLine[];
  productionMode: "controlled" | "after_action";
  lotsByIngredient: Record<string, BulkLotOption[]>;
  recipeId: string | null;
};

type BatchRow = {
  recipe_version_id?: string | null;
  quantity_produced?: number | null;
  recipes?: { id?: string; current_version_id?: string | null; yield_quantity?: number | null } | null;
};

type IngredientsRow = {
  material_lots?: { raw_materials?: { ingredient_id?: string } | null } | null;
  quantity_used?: number | string;
};

/**
 * Build everything the consumption UI needs given a batch row + its already-
 * consumed batch_ingredients. Both dashboards (admin and satellite) share
 * this so behavior stays consistent.
 */
export async function loadBatchConsumptionContext(
  supabase: SupabaseClient,
  batch: BatchRow,
  ingredients: IngredientsRow[] | null,
): Promise<BatchConsumptionContext> {
  const versionId = batch.recipe_version_id ?? batch.recipes?.current_version_id ?? null;
  const recipeId = batch.recipes?.id ?? null;

  let scannerLines: ScannerLine[] = [];
  if (versionId) {
    const { data: rvi } = await supabase
      .from("recipe_version_ingredients")
      .select("id, ingredient_id, quantity, unit, ingredients(name, unit)")
      .eq("recipe_version_id", versionId)
      .order("sort_order", { ascending: true });

    const yieldQty = batch.recipes?.yield_quantity ?? null;
    const produced = batch.quantity_produced ?? null;
    const scale = yieldQty && yieldQty > 0 && produced && produced > 0 ? produced / yieldQty : 1;

    const consumedByIngredient = new Map<string, number>();
    for (const bi of ingredients ?? []) {
      const ingId = bi.material_lots?.raw_materials?.ingredient_id;
      if (!ingId) continue;
      consumedByIngredient.set(ingId, (consumedByIngredient.get(ingId) ?? 0) + Number(bi.quantity_used));
    }

    scannerLines = (rvi ?? []).map((row) => {
      const r = row as unknown as {
        id: string;
        ingredient_id: string;
        quantity: number;
        unit: string | null;
        ingredients: { name: string; unit: string } | null;
      };
      return {
        rvi_id: r.id,
        ingredient_id: r.ingredient_id,
        ingredient_name: r.ingredients?.name || "Ingredient",
        required_qty: Number((Number(r.quantity) * scale).toFixed(4)),
        unit: r.unit || r.ingredients?.unit || "",
        consumed_qty: consumedByIngredient.get(r.ingredient_id) ?? 0,
      };
    });
  }

  // Production mode
  let productionMode: "controlled" | "after_action" = "controlled";
  const { data: meRow } = await supabase.auth.getUser();
  if (meRow?.user) {
    const { data: prof } = await supabase.from("users").select("org_id").eq("id", meRow.user.id).single();
    if (prof?.org_id) {
      const { data: org } = await supabase.from("organizations").select("production_mode").eq("id", prof.org_id).single();
      if (org?.production_mode === "after_action" || org?.production_mode === "controlled") {
        productionMode = org.production_mode;
      }
    }
  }

  // Lots-per-ingredient (only needed for after-action mode)
  const lotsByIngredient: Record<string, BulkLotOption[]> = {};
  if (productionMode === "after_action" && scannerLines.length > 0 && recipeId) {
    const ingredientIds = scannerLines.map((l) => l.ingredient_id);

    const { data: subs } = await supabase
      .from("recipe_ingredient_substitutions")
      .select("ingredient_id, raw_material_id")
      .eq("recipe_id", recipeId);
    const allowedByIngredient = new Map<string, Set<string>>();
    for (const s of subs ?? []) {
      const ing = (s as { ingredient_id: string }).ingredient_id;
      const mat = (s as { raw_material_id: string }).raw_material_id;
      if (!allowedByIngredient.has(ing)) allowedByIngredient.set(ing, new Set());
      allowedByIngredient.get(ing)!.add(mat);
    }

    const { data: lots } = await supabase
      .from("material_lots")
      .select("id, lot_number, quantity_remaining, expiry_date, raw_materials!inner(id, name, unit, ingredient_id, is_active)")
      .gt("quantity_remaining", 0)
      .in("raw_materials.ingredient_id", ingredientIds);

    for (const lot of lots ?? []) {
      const rmRaw = (lot as unknown as {
        raw_materials:
          | { id: string; name: string; unit: string; ingredient_id: string; is_active: boolean }
          | { id: string; name: string; unit: string; ingredient_id: string; is_active: boolean }[]
          | null;
      }).raw_materials;
      const rm = Array.isArray(rmRaw) ? rmRaw[0] : rmRaw;
      if (!rm || !rm.is_active) continue;
      const allowed = allowedByIngredient.get(rm.ingredient_id);
      if (allowed && !allowed.has(rm.id)) continue;
      if (!lotsByIngredient[rm.ingredient_id]) lotsByIngredient[rm.ingredient_id] = [];
      lotsByIngredient[rm.ingredient_id].push({
        id: (lot as { id: string }).id,
        lot_number: (lot as { lot_number: string }).lot_number,
        raw_material_id: rm.id,
        raw_material_name: rm.name,
        quantity_remaining: Number((lot as { quantity_remaining: number }).quantity_remaining),
        unit: rm.unit,
        expiry_date: (lot as { expiry_date: string | null }).expiry_date,
      });
    }
    for (const ing of Object.keys(lotsByIngredient)) {
      lotsByIngredient[ing].sort((a, b) => {
        if (a.expiry_date && b.expiry_date) return a.expiry_date.localeCompare(b.expiry_date);
        if (a.expiry_date) return -1;
        if (b.expiry_date) return 1;
        return 0;
      });
    }
  }

  return { scannerLines, productionMode, lotsByIngredient, recipeId };
}
