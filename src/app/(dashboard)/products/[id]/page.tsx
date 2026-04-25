import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import Link from "next/link";
import { ArrowLeft, Clock, Layers } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { BATCH_STATUSES } from "@/lib/constants";
import { notFound } from "next/navigation";
import { ProductDetailHeader } from "@/components/products/product-detail-header";
import { ProductDetailInfo } from "@/components/products/product-detail-info";
import { ProductComponentsSection } from "@/components/products/product-components-section";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("products.view");
  const canEdit = await checkPermission("products.edit");

  const { id } = await params;
  const supabase = await createClient();

  // Fetch the product with category
  const { data: product } = await supabase
    .from("products")
    .select("*, product_categories(name)")
    .eq("id", id)
    .single();

  if (!product) return notFound();

  // Fetch categories for inline editing
  const { data: categories } = await supabase
    .from("product_categories")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  // Fetch what goes INTO this product (its components)
  const { data: components } = await supabase
    .from("product_components")
    .select("*")
    .eq("product_id", id);

  // Enrich components with recipe/product names
  const enrichedComponents = await Promise.all(
    (components || []).map(async (comp: any) => {
      if (comp.component_type === "recipe" && comp.recipe_id) {
        const { data: recipe } = await supabase
          .from("recipes")
          .select("id, name, yield_unit")
          .eq("id", comp.recipe_id)
          .single();
        return { ...comp, recipe };
      } else if (comp.component_type === "product" && comp.component_product_id) {
        const { data: childProduct } = await supabase
          .from("products")
          .select("id, name, sku")
          .eq("id", comp.component_product_id)
          .single();
        return { ...comp, child_product: childProduct };
      }
      return comp;
    })
  );

  // Fetch products that CONTAIN this product (parents)
  const { data: parentComponents } = await supabase
    .from("product_components")
    .select("*, products!product_components_product_id_fkey(id, name, sku)")
    .eq("component_product_id", id)
    .eq("component_type", "product");

  // Fetch batches for this product
  const { data: batches } = await supabase
    .from("batches")
    .select("*")
    .eq("product_id", id)
    .order("created_at", { ascending: false });

  // Fetch order items
  const batchIds = (batches || []).map((b: any) => b.id);
  let orderItems: any[] = [];
  if (batchIds.length > 0) {
    const { data } = await supabase
      .from("order_items")
      .select("*, orders(order_number, customer_name, status, order_date)")
      .in("batch_id", batchIds);
    orderItems = data || [];
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/products" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft size={16} /> Back to Products
      </Link>

      {/* Header — name + active toggle (inline-editable) */}
      <ProductDetailHeader
        product={product}
        canEdit={canEdit}
      />

      {/* Info cards — category, unit, description (inline-editable) */}
      <ProductDetailInfo
        product={product}
        categories={categories || []}
        componentCount={enrichedComponents.length}
        parentCount={(parentComponents || []).length}
        canEdit={canEdit}
      />

      {/* Components — inline qty editing, add/remove */}
      <ProductComponentsSection
        productId={id}
        components={enrichedComponents}
        canEdit={canEdit}
      />

      {/* Used In (parent products) — read-only */}
      {(parentComponents || []).length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Used In These Products</h2>
          <p className="text-sm text-gray-500 mb-4">Parent products that contain this product</p>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Product</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">SKU</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Qty Used</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(parentComponents || []).map((comp: any) => (
                <tr key={comp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <Link href={`/products/${comp.products?.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                      {comp.products?.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{comp.products?.sku}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{comp.quantity}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{comp.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Batches */}
      {(batches || []).length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Production Batches</h2>
          <p className="text-sm text-gray-500 mb-4">All batches produced for this product</p>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Batch Number</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Qty Produced</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(batches || []).map((batch: any) => {
                const statusInfo = BATCH_STATUSES[batch.status as keyof typeof BATCH_STATUSES];
                return (
                  <tr key={batch.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <Link href={`/batches/${batch.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                        {batch.batch_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo?.color || "bg-gray-100 text-gray-800"}`}>
                        {statusInfo?.label || batch.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {batch.quantity_produced ?? "—"} {batch.quantity_produced ? product.unit : ""}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(batch.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Orders */}
      {orderItems.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Related Orders</h2>
          <p className="text-sm text-gray-500 mb-4">Customer orders that include this product</p>
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
              {orderItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <Link href="/orders" className="text-blue-600 hover:text-blue-800 font-medium">
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
        </div>
      )}

      {/* Metadata */}
      <div className="text-xs text-gray-400">
        Created {formatDate(product.created_at)} · Last updated {formatDate(product.updated_at)}
      </div>
    </div>
  );
}
