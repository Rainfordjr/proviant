"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { generateOrderNumber } from "@/lib/utils";
import { useRequirePermission } from "@/lib/usePermission";
import { CustomerPicker } from "@/components/orders/customer-picker";

interface OrderLine {
  productId: string;
  quantity: string;
  unitPrice: string;
}

export default function NewOrderPage() {
  const { loading: permLoading } = useRequirePermission("orders.create");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Array<{ id: string; name: string; sku: string | null }>>([]);

  const [orderNumber, setOrderNumber] = useState(generateOrderNumber());
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([{ productId: "", quantity: "1", unitPrice: "0" }]);

  useEffect(() => {
    const fetchProducts = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("products").select("id, name, sku").eq("is_active", true).order("name");
      setProducts(data || []);
    };
    fetchProducts();
  }, []);

  const addLine = () => setLines([...lines, { productId: "", quantity: "1", unitPrice: "0" }]);
  const removeLine = (idx: number) => setLines(lines.filter((_, i) => i !== idx));
  const updateLine = (idx: number, field: keyof OrderLine, value: string) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    setLines(updated);
  };

  const total = lines.reduce((sum, l) => sum + (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const validLines = lines.filter((l) => l.productId && parseFloat(l.quantity) > 0);
    if (validLines.length === 0) { setError("Add at least one line item."); setLoading(false); return; }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("You must be logged in."); setLoading(false); return; }

    const { data: profile } = await supabase.from("users").select("org_id").eq("id", user.id).single();
    if (!profile) { setError("Could not find your organization."); setLoading(false); return; }

    // Create the order
    const { data: order, error: orderError } = await supabase.from("orders").insert({
      org_id: profile.org_id,
      order_number: orderNumber,
      customer_id: customerId,
      customer_name: customerName,
      customer_email: customerEmail || null,
      notes: notes || null,
      status: "pending",
    }).select().single();

    if (orderError) { setError(orderError.message); setLoading(false); return; }

    // Create order items
    const items = validLines.map((l) => ({
      order_id: order.id,
      product_id: l.productId,
      quantity: parseFloat(l.quantity),
      unit_price: parseFloat(l.unitPrice) || 0,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(items);
    if (itemsError) { setError("Order created but failed to add items: " + itemsError.message); setLoading(false); return; }

    setLoading(false);
    router.push("/orders");
    router.refresh();
  };

  if (permLoading) return <div className="p-8 text-center text-sm text-gray-500">Checking permissions…</div>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/orders" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={16} /> Back to Orders
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Order</h1>
        <p className="text-sm text-gray-500">Create a new customer order</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {/* Order details */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Order Details</h2>

          <div>
            <label htmlFor="orderNumber" className="block text-sm font-medium text-gray-700">Order Number *</label>
            <input id="orderNumber" type="text" required value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
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
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes</label>
            <input id="notes" type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Delivery instructions, etc."
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>

        {/* Line items */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Line Items</h2>
            <button type="button" onClick={addLine}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
              <Plus size={14} /> Add Item
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((line, idx) => (
              <div key={idx} className="flex items-end gap-3">
                <div className="flex-[3]">
                  {idx === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Product</label>}
                  <select value={line.productId} onChange={(e) => updateLine(idx, "productId", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="">Select product...</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  {idx === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>}
                  <input type="number" min="1" step="1" value={line.quantity} onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div className="flex-1">
                  {idx === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Unit Price</label>}
                  <input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => updateLine(idx, "unitPrice", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div className="flex-shrink-0">
                  {lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(idx)} className="rounded-lg p-2 text-gray-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <p className="text-sm text-gray-700">
              Total: <span className="text-lg font-bold text-gray-900">${total.toFixed(2)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link href="/orders" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</Link>
          <button type="submit" disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Creating..." : "Create Order"}
          </button>
        </div>
      </form>
    </div>
  );
}
