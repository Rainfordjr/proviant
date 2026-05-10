import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import Link from "next/link";
import { ArrowLeft, Package, Clock, ChefHat, FileText, ShoppingBag } from "lucide-react";
import { BATCH_STATUSES } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import { notFound } from "next/navigation";
import { ConsumptionScanner } from "@/components/batches/consumption-scanner";
import { BulkConsumptionEditor } from "@/components/batches/bulk-consumption-editor";

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("batches.view");
  const canEdit = await checkPermission("batches.edit");

  const { id } = await params;
  const supabase = await createClient();

  // Fetch batch with recipe and product info
  const { data: batch } = await supabase
    .from("batches")
    .select("*, recipes(id, name, yield_quantity, yield_unit, current_version_id), products(id, name, sku, category, unit)")
    .eq("id", id)
    .single();

  if (!batch) return notFound();

  // Fetch batch ingredients with material lot and raw material info
  const { data: ingredients } = await supabase
    .from("batch_ingredients")
    .select("*, material_lots(*, raw_materials(name, unit, ingredient_id))")
    .eq("batch_id", id);

  // Resolve recipe version → ingredient slots for the consumption scanner
  const versionId =
    (batch as { recipe_version_id: string | null }).recipe_version_id ??
    (batch as { recipes: { current_version_id: string | null } | null }).recipes?.current_version_id ??
    null;
  let scannerLines: { rvi_id: string; ingredient_id: string; ingredient_name: string; required_qty: number; unit: string; consumed_qty: number }[] = [];
  if (versionId) {
    const { data: rvi } = await supabase
      .from("recipe_version_ingredients")
      .select("id, ingredient_id, quantity, unit, ingredients(name, unit)")
      .eq("recipe_version_id", versionId)
      .order("sort_order", { ascending: true });
    const yieldQty = (batch as { recipes: { yield_quantity: number | null } | null }).recipes?.yield_quantity ?? null;
    const produced = (batch as { quantity_produced: number | null }).quantity_produced ?? null;
    const scale = yieldQty && yieldQty > 0 && produced && produced > 0 ? produced / yieldQty : 1;

    // Tally what's already been consumed per ingredient_id
    const consumedByIngredient = new Map<string, number>();
    for (const bi of ingredients ?? []) {
      const ingId = (bi as { material_lots: { raw_materials: { ingredient_id: string } | null } | null }).material_lots?.raw_materials?.ingredient_id;
      if (!ingId) continue;
      consumedByIngredient.set(ingId, (consumedByIngredient.get(ingId) ?? 0) + Number((bi as { quantity_used: number }).quantity_used));
    }

    scannerLines = (rvi ?? []).map((row) => {
      const r = row as unknown as { id: string; ingredient_id: string; quantity: number; unit: string | null; ingredients: { name: string; unit: string } | null };
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

  // Fetch the org's production mode + the recipe's substitution allow-list +
  // active lots, so after-action mode can show valid lot options per ingredient.
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

  // Build lots-per-ingredient map for the bulk editor (after-action mode only).
  type BulkLotOption = {
    id: string;
    lot_number: string;
    raw_material_id: string;
    raw_material_name: string;
    quantity_remaining: number;
    unit: string;
    expiry_date: string | null;
  };
  const lotsByIngredient: Record<string, BulkLotOption[]> = {};
  if (productionMode === "after_action" && scannerLines.length > 0 && (batch as { recipes: { id: string } | null }).recipes?.id) {
    const recipeId = (batch as { recipes: { id: string } }).recipes.id;
    const ingredientIds = scannerLines.map((l) => l.ingredient_id);

    // Substitution allow-lists for this recipe (per ingredient, may be empty)
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

    // All active lots whose material satisfies one of the recipe's ingredients
    const { data: lots } = await supabase
      .from("material_lots")
      .select("id, lot_number, quantity_remaining, expiry_date, raw_materials!inner(id, name, unit, ingredient_id, is_active)")
      .gt("quantity_remaining", 0)
      .in("raw_materials.ingredient_id", ingredientIds);

    for (const lot of lots ?? []) {
      // Supabase types `!inner` joins as an array; in practice with maybeSingle/single
      // semantics on a 1:1 FK it's effectively the joined row. Normalize both shapes.
      const rmRaw = (lot as unknown as { raw_materials: { id: string; name: string; unit: string; ingredient_id: string; is_active: boolean } | { id: string; name: string; unit: string; ingredient_id: string; is_active: boolean }[] | null }).raw_materials;
      const rm = Array.isArray(rmRaw) ? rmRaw[0] : rmRaw;
      if (!rm || !rm.is_active) continue;
      const allowed = allowedByIngredient.get(rm.ingredient_id);
      // Empty allow-list = any active material works. Non-empty = restricted.
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
    // FIFO suggestion: sort lots by expiry asc within each ingredient
    for (const ing of Object.keys(lotsByIngredient)) {
      lotsByIngredient[ing].sort((a, b) => {
        if (a.expiry_date && b.expiry_date) return a.expiry_date.localeCompare(b.expiry_date);
        if (a.expiry_date) return -1;
        if (b.expiry_date) return 1;
        return 0;
      });
    }
  }

  // Fetch orders that reference this batch
  const { data: orderItems } = await supabase
    .from("order_items")
    .select("*, orders(order_number, customer_name, status)")
    .eq("batch_id", id);

  const statusInfo = BATCH_STATUSES[batch.status as keyof typeof BATCH_STATUSES];
  const recipe = (batch as any).recipes;
  const product = (batch as any).products;

  return (
    <div className="space-y-6">
      {/* Back link + header */}
      <div>
        <Link href="/batches" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={16} /> Back to Batches
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{batch.batch_number}</h1>
            <div className="flex items-center gap-3 mt-1">
              {recipe && (
                <Link href={`/recipes/${recipe.id}`} className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-800">
                  <ChefHat size={14} /> {recipe.name}
                </Link>
              )}
              {product && (
                <Link href={`/products/${product.id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                  <ShoppingBag size={14} /> {product.name} ({product.sku})
                </Link>
              )}
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusInfo?.color || "bg-gray-100 text-gray-800"}`}>
            {statusInfo?.label || batch.status}
          </span>
        </div>
      </div>

      {/* Info cards row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Package size={16} /> <span className="text-xs font-medium uppercase">Quantity Produced</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {batch.quantity_produced ?? "—"} {batch.quantity_produced ? (recipe?.yield_unit || product?.unit || "") : ""}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Clock size={16} /> <span className="text-xs font-medium uppercase">Produced At</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {batch.produced_at ? formatDate(batch.produced_at) : "In progress"}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <ChefHat size={16} /> <span className="text-xs font-medium uppercase">Recipe Yield</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {recipe ? `${recipe.yield_quantity} ${recipe.yield_unit}` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <FileText size={16} /> <span className="text-xs font-medium uppercase">Ingredients Used</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{(ingredients || []).length}</p>
        </div>
      </div>

      {/* Consume materials — UI varies by org's production_mode */}
      {canEdit && scannerLines.length > 0 && (
        productionMode === "controlled" ? (
          <ConsumptionScanner batchId={id} lines={scannerLines} />
        ) : (
          <BulkConsumptionEditor
            batchId={id}
            lines={scannerLines}
            lotsByIngredient={lotsByIngredient}
          />
        )
      )}

      {/* Ingredients / Traceability */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Ingredient Traceability</h2>
        <p className="text-sm text-gray-500 mb-4">Raw materials and lots used in this batch</p>

        {(ingredients || []).length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No ingredients linked to this batch yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Material</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Lot Number</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Qty Used</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Lot Expiry</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Lot Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(ingredients || []).map((ing: any) => {
                const lot = ing.material_lots;
                const material = lot?.raw_materials;
                const isExpiringSoon = lot?.expiry_date &&
                  new Date(lot.expiry_date).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

                return (
                  <tr key={ing.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{material?.name || "Unknown"}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{lot?.lot_number || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{ing.quantity_used} {material?.unit || ""}</td>
                    <td className="px-4 py-3 text-sm">
                      {lot?.expiry_date ? (
                        <span className={isExpiringSoon ? "text-red-600 font-medium" : "text-gray-700"}>
                          {formatDate(lot.expiry_date)}
                          {isExpiringSoon && " (!)"}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {lot?.quantity_remaining ?? "—"} {material?.unit || ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Orders using this batch */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Orders Using This Batch</h2>
        <p className="text-sm text-gray-500 mb-4">Customer orders fulfilled with products from this batch</p>

        {(orderItems || []).length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No orders linked to this batch yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Order</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Customer</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Quantity</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(orderItems || []).map((item: any) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <Link href={`/orders/${item.orders?.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                      {item.orders?.order_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{item.orders?.customer_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{item.quantity}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 capitalize">
                      {item.orders?.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Notes */}
      {batch.notes && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
          <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{batch.notes}</p>
        </div>
      )}
    </div>
  );
}
