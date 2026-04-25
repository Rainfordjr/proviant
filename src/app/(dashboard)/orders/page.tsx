import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ORDER_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export default async function OrdersPage() {
  await requirePermission("orders.view");
  const canCreate = await checkPermission("orders.create");

  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("*, order_items(id, quantity, unit_price)")
    .order("ordered_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500">Manage customer orders and fulfillment</p>
        </div>
        {canCreate && (
          <Link href="/orders/new"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={16} /> New Order
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Order Number</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Items</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Total</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(orders || []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                  No orders yet.
                </td>
              </tr>
            ) : (
              (orders || []).map((order: any) => {
                const statusInfo = ORDER_STATUSES[order.status as keyof typeof ORDER_STATUSES];
                const itemCount = order.order_items?.length || 0;
                const total = (order.order_items || []).reduce(
                  (sum: number, item: any) => sum + item.quantity * item.unit_price, 0
                );
                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link href={`/orders/${order.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{order.customer_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{itemCount} items</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">${total.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo?.color || "bg-gray-100 text-gray-800"}`}>
                        {statusInfo?.label || order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{formatDate(order.ordered_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/orders/${order.id}`} className="text-sm text-gray-500 hover:text-gray-900">View &rarr;</Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
