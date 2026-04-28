import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Mail,
  StickyNote,
  Building2,
  Calendar,
  Truck,
  FileText,
} from "lucide-react";
import { ORDER_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { OrderStatusActions } from "@/components/orders/order-status-actions";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("orders.view");
  const canEdit = await checkPermission("orders.edit");

  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "*, order_items(id, quantity, unit_price, product_id, products(id, name, sku))"
    )
    .eq("id", id)
    .single();

  if (!order) return notFound();

  // If a customer is linked, fetch them for the side panel.
  let customer: { id: string; name: string; email: string | null } | null = null;
  if (order.customer_id) {
    const { data } = await supabase
      .from("customers")
      .select("id, name, email")
      .eq("id", order.customer_id)
      .maybeSingle();
    customer = data;
  }

  // Invoice (auto-created when status='confirmed', if customer is linked).
  // RLS scopes this to the caller's org.
  const { data: invoice } = await supabase
    .from("customer_invoices")
    .select("id, invoice_number, status, total")
    .eq("order_id", order.id)
    .maybeSingle();

  const statusInfo =
    ORDER_STATUSES[order.status as keyof typeof ORDER_STATUSES];

  const items = order.order_items ?? [];
  const total = items.reduce(
    (sum: number, item: { quantity: number; unit_price: number }) =>
      sum + Number(item.quantity) * Number(item.unit_price),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/orders"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={16} /> Back to Orders
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {order.order_number}
              </h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  statusInfo?.color ?? "bg-gray-100 text-gray-800"
                }`}
              >
                {statusInfo?.label ?? order.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Placed {formatDate(order.ordered_at)}
              {order.shipped_at && (
                <> · Shipped {formatDate(order.shipped_at)}</>
              )}
            </p>
          </div>

          {canEdit && (
            <Link
              href={`/orders/${order.id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Pencil size={14} /> Edit
            </Link>
          )}
        </div>
      </div>

      {/* Two-column layout: main content + side panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Line items */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">
                Line Items
              </h2>
              <p className="text-sm text-gray-500">
                {items.length} {items.length === 1 ? "item" : "items"}
              </p>
            </div>

            {items.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-500">
                This order has no line items.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-3 text-left">Product</th>
                    <th className="px-6 py-3 text-right">Qty</th>
                    <th className="px-6 py-3 text-right">Unit Price</th>
                    <th className="px-6 py-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(
                    (item: {
                      id: string;
                      quantity: number;
                      unit_price: number;
                      products: { id: string; name: string; sku: string } | null;
                    }) => {
                      const lineTotal =
                        Number(item.quantity) * Number(item.unit_price);
                      return (
                        <tr key={item.id}>
                          <td className="px-6 py-4 text-sm">
                            <div className="font-medium text-gray-900">
                              {item.products?.name ?? "(deleted product)"}
                            </div>
                            {item.products?.sku && (
                              <div className="text-xs text-gray-500">
                                {item.products.sku}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-gray-700">
                            {Number(item.quantity)}
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-gray-700">
                            ${Number(item.unit_price).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                            ${lineTotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    }
                  )}
                  <tr className="bg-gray-50">
                    <td
                      colSpan={3}
                      className="px-6 py-3 text-right text-sm font-semibold text-gray-700"
                    >
                      Total
                    </td>
                    <td className="px-6 py-3 text-right text-base font-bold text-gray-900">
                      ${total.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <StickyNote size={16} className="text-gray-400" />
                Notes
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                {order.notes}
              </p>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-6">
          {/* Status workflow */}
          {canEdit && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">Status</h2>
              <p className="mt-1 text-sm text-gray-500">
                Move this order through the fulfillment workflow.
              </p>
              <div className="mt-4">
                <OrderStatusActions
                  orderId={order.id}
                  currentStatus={order.status}
                />
              </div>
            </div>
          )}

          {/* Invoice */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-gray-400" />
              <h2 className="text-base font-semibold text-gray-900">Invoice</h2>
            </div>
            {invoice ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Link
                    href={
                      customer ? `/customers/${customer.id}` : "/orders"
                    }
                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    {invoice.invoice_number}
                  </Link>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      invoice.status === "paid"
                        ? "bg-green-100 text-green-800"
                        : invoice.status === "partial"
                        ? "bg-blue-100 text-blue-800"
                        : invoice.status === "void"
                        ? "bg-gray-100 text-gray-500"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {invoice.status}
                  </span>
                </div>
                <p className="text-sm text-gray-700">
                  Total ${Number(invoice.total).toFixed(2)}
                </p>
                {customer && (
                  <Link
                    href={`/customers/${customer.id}`}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    View customer billing →
                  </Link>
                )}
              </div>
            ) : order.customer_id ? (
              <p className="text-sm text-gray-500">
                Not yet invoiced. An invoice is generated automatically when
                this order moves to <strong>Confirmed</strong>.
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                Walk-in orders are not invoiced. Link this order to a
                customer to enable billing.
              </p>
            )}
          </div>

          {/* Customer */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-3">
            <h2 className="text-base font-semibold text-gray-900">Customer</h2>

            <div className="flex items-start gap-2 text-sm">
              <Building2 size={16} className="mt-0.5 text-gray-400" />
              <div>
                <div className="font-medium text-gray-900">
                  {order.customer_name}
                </div>
                {customer && customer.id !== order.customer_id ? null : null}
                {customer && (
                  <Link
                    href={`/customers/${customer.id}`}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    View customer profile →
                  </Link>
                )}
                {!order.customer_id && (
                  <div className="text-xs text-gray-500">
                    Walk-in (not linked to a customer record)
                  </div>
                )}
              </div>
            </div>

            {order.customer_email && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Mail size={16} className="text-gray-400" />
                <a
                  href={`mailto:${order.customer_email}`}
                  className="hover:text-gray-900"
                >
                  {order.customer_email}
                </a>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-3">
            <h2 className="text-base font-semibold text-gray-900">Timeline</h2>

            <div className="flex items-start gap-2 text-sm">
              <Calendar size={16} className="mt-0.5 text-gray-400" />
              <div>
                <div className="text-gray-700">Ordered</div>
                <div className="text-xs text-gray-500">
                  {formatDate(order.ordered_at)}
                </div>
              </div>
            </div>

            {order.shipped_at && (
              <div className="flex items-start gap-2 text-sm">
                <Truck size={16} className="mt-0.5 text-gray-400" />
                <div>
                  <div className="text-gray-700">Shipped</div>
                  <div className="text-xs text-gray-500">
                    {formatDate(order.shipped_at)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
