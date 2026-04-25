import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import Link from "next/link";
import { ArrowLeft, Package, Clock, ChefHat, FileText, ShoppingBag } from "lucide-react";
import { BATCH_STATUSES } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("batches.view");

  const { id } = await params;
  const supabase = await createClient();

  // Fetch batch with recipe and product info
  const { data: batch } = await supabase
    .from("batches")
    .select("*, recipes(id, name, yield_quantity, yield_unit), products(id, name, sku, category, unit)")
    .eq("id", id)
    .single();

  if (!batch) return notFound();

  // Fetch batch ingredients with material lot and raw material info
  const { data: ingredients } = await supabase
    .from("batch_ingredients")
    .select("*, material_lots(*, raw_materials(name, unit))")
    .eq("batch_id", id);

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
