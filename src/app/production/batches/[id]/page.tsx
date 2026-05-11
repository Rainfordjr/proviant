import Link from "next/link";
import { ArrowLeft, ChefHat, ShoppingBag } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { BATCH_STATUSES } from "@/lib/constants";
import { ConsumptionScanner } from "@/components/batches/consumption-scanner";
import { BulkConsumptionEditor } from "@/components/batches/bulk-consumption-editor";
import { loadBatchConsumptionContext } from "@/lib/batch-consumption";
import { CompleteBatchButton } from "../complete-button";

export default async function ProductionBatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("batches.view");
  const { id } = await params;
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("batches")
    .select("*, recipes(id, name, yield_quantity, yield_unit, current_version_id), products(id, name, sku, unit)")
    .eq("id", id)
    .single();

  if (!batch) return notFound();

  const { data: ingredients } = await supabase
    .from("batch_ingredients")
    .select("*, material_lots(*, raw_materials(name, unit, ingredient_id))")
    .eq("batch_id", id);

  const ctx = await loadBatchConsumptionContext(supabase, batch as never, ingredients as never);
  const { scannerLines, productionMode, lotsByIngredient } = ctx;

  const status = BATCH_STATUSES[batch.status as keyof typeof BATCH_STATUSES] || BATCH_STATUSES.planned;
  const recipe = (batch as { recipes?: { name?: string } | null }).recipes;
  const product = (batch as { products?: { name?: string; sku?: string } | null }).products;

  const allDone =
    scannerLines.length > 0 &&
    scannerLines.every((l) => l.consumed_qty >= l.required_qty);

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100 bg-white">
        <Link href="/production/queue" className="inline-flex items-center gap-1 text-sm text-gray-500 mb-2">
          <ArrowLeft size={16} /> Queue
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">{batch.batch_number}</h1>
            {product?.name && (
              <p className="text-sm text-gray-700 flex items-center gap-1.5 mt-0.5">
                <ShoppingBag size={14} className="text-gray-400" /> {product.name}
              </p>
            )}
            {recipe?.name && (
              <p className="text-sm text-gray-500 flex items-center gap-1.5">
                <ChefHat size={14} className="text-gray-400" /> {recipe.name}
              </p>
            )}
          </div>
          <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
            {status.label}
          </span>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-6 space-y-4 pb-24">
        {scannerLines.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No recipe ingredients to consume for this batch.
          </p>
        ) : productionMode === "controlled" ? (
          <ConsumptionScanner batchId={id} lines={scannerLines} />
        ) : (
          <BulkConsumptionEditor batchId={id} lines={scannerLines} lotsByIngredient={lotsByIngredient} />
        )}
      </div>

      <div
        className="sticky bottom-0 border-t border-gray-200 bg-white px-4 py-3 sm:px-6"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <CompleteBatchButton batchId={id} disabled={!allDone || batch.status === "completed"} alreadyComplete={batch.status === "completed"} />
      </div>
    </div>
  );
}
