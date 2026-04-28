"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRequirePermission } from "@/lib/usePermission";
import { CustomerPicker } from "@/components/orders/customer-picker";

interface OrderLine {
  /** Existing row id, or undefined if added during this edit. */
  id?: string;
  productId: string;
  quantity: string;
  unitPrice: string;
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
}

export default function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { loading: permLoading } = useRequirePermission("orders.edit");
  const router = useRouter();

  const [orderId, setOrderId] = useState<string>("");
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  const [orderNumber, setOrderNumber] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([]);

  // Track the original line item ids so we can compute deletes on save.
  const [originalLineIds, setOriginalLineIds] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      const { id } = await params;
      setOrderId(id);

      const supabase = createClient();

      const [{ data: order, error: orderErr }, { data: prods }] = await Promise.all([
        supabase
          .from("orders")
          .select(
            "id, order_number, customer_id, customer_name, customer_email, notes, order_items(id, product_id, quantity, unit_price)"
          )
          .eq("id", id)
          .single(),
        supabase
          .from("products")
          .select("id, name, sku")
          .eq("is_active", true)
          .order("name"),
      ]);

      if (orderErr || !order) {
        setError("Order not found.");
        setFetching(false);
        return;
      }

      setOrderNumber(order.order_number);
      setCustomerId(order.customer_id ?? null);
      setCustomerName(order.customer_name ?? "");
      setCustomerEmail(order.customer_email ?? "");
      setNotes(order.notes ?? "");

      const items = (order.order_items ?? []) as Array<{
        id: string;
        product_id: string;
        quantity: number;
        unit_price: number;
      }>;
      setLines(
        items.length === 0
          ? [{ productId: "", quantity: "1", unitPrice: "0" }]
          : items.map((it) => ({
              id: it.id,
              productId: it.product_id,
              quantity: String(it.quantity),
              unitPrice: String(it.unit_price),
            }))
      );
      setOriginalLineIds(items.map((it) => it.id));
      setProducts(prods ?? []);
      setFetching(false);
    };
    load();
  }, [params]);

  const addLine = () =>
    setLines([...lines, { productId: "", quantity: "1", unitPrice: "0" }]);

  const removeLine = (idx: number) =>
    setLines(lines.filter((_, i) => i !== idx));

  const updateLine = (
    idx: number,
    field: "productId" | "quantity" | "unitPrice",
    value: string
  ) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    setLines(updated);
  };

  const total = lines.reduce(
    (sum, l) =>
      sum + (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0),
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);

    const validLines = lines.filter(
      (l) => l.productId && parseFloat(l.quantity) > 0
    );
    if (validLines.length === 0) {
      setError("Add at least one line item.");
      setSaving(false);
      return;
    }

    const supabase = createClient();

    // 1. Update the order header
    const { error: updateErr } = await supabase
      .from("orders")
      .update({
        order_number: orderNumber,
        customer_id: customerId,
        customer_name: customerName,
        customer_email: customerEmail || null,
        notes: notes || null,
      })
      .eq("id", orderId);

    if (updateErr) {
      setError(updateErr.message);
      setSaving(false);
      return;
    }

    // 2. Reconcile line items: split into kept (with id), updated, new (no id).
    const keptIds = new Set(
      validLines.filter((l) => l.id).map((l) => l.id as string)
    );
    const toDelete = originalLineIds.filter((id) => !keptIds.has(id));

    if (toDelete.length > 0) {
      const { error: delErr } = await supabase
        .from("order_items")
        .delete()
        .in("id", toDelete);
      if (delErr) {
        setError("Failed to remove deleted items: " + delErr.message);
        setSaving(false);
        return;
      }
    }

    // Update existing rows
    for (const line of validLines.filter((l) => l.id)) {
      const { error: upErr } = await supabase
        .from("order_items")
        .update({
          product_id: line.productId,
          quantity: parseFloat(line.quantity),
          unit_price: parseFloat(line.unitPrice) || 0,
        })
        .eq("id", line.id as string);
      if (upErr) {
        setError("Failed to update item: " + upErr.message);
        setSaving(false);
        return;
      }
    }

    // Insert new rows
    const toInsert = validLines
      .filter((l) => !l.id)
      .map((l) => ({
        order_id: orderId,
        product_id: l.productId,
        quantity: parseFloat(l.quantity),
        unit_price: parseFloat(l.unitPrice) || 0,
      }));
    if (toInsert.length > 0) {
      const { error: insErr } = await supabase
        .from("order_items")
        .insert(toInsert);
      if (insErr) {
        setError("Failed to add new items: " + insErr.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    router.push(`/orders/${orderId}`);
    router.refresh();
  };

  if (permLoading || fetching)
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        Loading order…
      </div>
    );

  if (error && !orderNumber) {
    return (
      <div className="space-y-4">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={16} /> Back to Orders
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/orders/${orderId}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={16} /> Back to Order
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Order</h1>
        <p className="text-sm text-gray-500">
          Update the customer, line items, or notes on this order.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-gray-900">
            Order Details
          </h2>

          <div>
            <label
              htmlFor="orderNumber"
              className="block text-sm font-medium text-gray-700"
            >
              Order Number *
            </label>
            <input
              id="orderNumber"
              type="text"
              required
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <CustomerPicker
            customerId={customerId}
            customerName={customerName}
            customerEmail={customerEmail}
            onChange={(next) => {
              setCustomerId(next.customerId);
              setCustomerName(next.customerName);
              setCustomerEmail(next.customerEmail);
            }}
          />

          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-gray-700"
            >
              Notes
            </label>
            <input
              id="notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Delivery instructions, etc."
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              Line Items
            </h2>
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              <Plus size={14} /> Add Item
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((line, idx) => (
              <div key={line.id ?? `new-${idx}`} className="flex items-end gap-3">
                <div className="flex-[3]">
                  {idx === 0 && (
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Product
                    </label>
                  )}
                  <select
                    value={line.productId}
                    onChange={(e) =>
                      updateLine(idx, "productId", e.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select product...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.sku ? ` (${p.sku})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  {idx === 0 && (
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Qty
                    </label>
                  )}
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(idx, "quantity", e.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1">
                  {idx === 0 && (
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Unit Price
                    </label>
                  )}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(e) =>
                      updateLine(idx, "unitPrice", e.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex-shrink-0">
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="rounded-lg p-2 text-gray-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <p className="text-sm text-gray-700">
              Total:{" "}
              <span className="text-lg font-bold text-gray-900">
                ${total.toFixed(2)}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/orders/${orderId}`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
