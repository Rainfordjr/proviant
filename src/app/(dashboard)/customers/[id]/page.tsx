import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import Link from "next/link";
import { ArrowLeft, Building2, Mail, Phone, MapPin, CheckCircle, XCircle, Pencil } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ORDER_STATUSES } from "@/lib/constants";
import { notFound } from "next/navigation";
import {
  CustomerBillingPanel,
  type InvoiceRow,
  type PaymentRow,
  type SavedCardRow,
} from "@/components/customers/customer-billing-panel";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("customers.view");
  const canEdit = await checkPermission("customers.edit");
  const canViewBilling = await checkPermission("customer_billing.view");
  const canManageBilling = await checkPermission("customer_billing.manage");

  const { id } = await params;
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (!customer) return notFound();

  // Fetch orders for this customer
  const { data: orders } = await supabase
    .from("orders")
    .select("*, order_items(quantity, unit_price)")
    .eq("customer_id", id)
    .order("ordered_at", { ascending: false });

  // Also check orders by customer_name for backward compat
  const { data: legacyOrders } = await supabase
    .from("orders")
    .select("*, order_items(quantity, unit_price)")
    .eq("customer_name", customer.name)
    .is("customer_id", null)
    .order("ordered_at", { ascending: false });

  const allOrders = [...(orders || []), ...(legacyOrders || [])];

  const totalRevenue = allOrders.reduce((sum, order) => {
    const items = (order.order_items ?? []) as Array<{
      quantity: number;
      unit_price: number;
    }>;
    const orderTotal = items.reduce(
      (s, item) => s + Number(item.quantity) * Number(item.unit_price),
      0
    );
    return sum + orderTotal;
  }, 0);

  // ----------------------------------------------------------------
  // Customer billing data (only fetched if the user can see it)
  // ----------------------------------------------------------------
  let billing: {
    balance: number;
    creditAvailable: number;
    invoices: InvoiceRow[];
    payments: PaymentRow[];
    savedCards: SavedCardRow[];
  } | null = null;

  if (canViewBilling) {
    // Balance + unapplied credit via SQL functions. RPC returns numeric ->
    // string in supabase-js, so coerce defensively.
    const [{ data: balanceRaw }, { data: creditRaw }] = await Promise.all([
      supabase.rpc("customer_balance", { p_customer_id: id }),
      supabase.rpc("customer_unapplied_credit", { p_customer_id: id }),
    ]);
    const balance = Number(balanceRaw ?? 0);
    const creditAvailable = Number(creditRaw ?? 0);

    // Invoices + per-invoice applied total via embedded relation
    const { data: rawInvoices } = await supabase
      .from("customer_invoices")
      .select(
        "id, invoice_number, kind, status, issued_at, total, order_id, notes, customer_payment_applications(amount)"
      )
      .eq("customer_id", id)
      .order("issued_at", { ascending: false });

    const invoices: InvoiceRow[] = (rawInvoices ?? []).map((row: {
      id: string;
      invoice_number: string;
      kind: string;
      status: string;
      issued_at: string;
      total: number | string;
      order_id: string | null;
      notes: string | null;
      customer_payment_applications: { amount: number | string }[] | null;
    }) => ({
      id: row.id,
      invoice_number: row.invoice_number,
      kind: row.kind as "invoice" | "credit_note",
      status: row.status as "open" | "partial" | "paid" | "void",
      issued_at: row.issued_at,
      total: Number(row.total),
      applied: (row.customer_payment_applications ?? []).reduce(
        (s, app) => s + Number(app.amount),
        0
      ),
      order_id: row.order_id,
      notes: row.notes,
    }));

    // Payments + the invoices each one was applied to. Supabase-js's
    // generated typing for nested FK relations is wobbly here (sometimes
    // single object, sometimes array) so we accept it via `unknown` and
    // normalize at the boundary.
    const { data: rawPayments } = await supabase
      .from("customer_payments")
      .select(
        "id, amount, method, reference_number, received_at, notes, customer_payment_applications(invoice_id, amount, customer_invoices(invoice_number))"
      )
      .eq("customer_id", id)
      .order("received_at", { ascending: false });

    type RawApplication = {
      invoice_id: string;
      amount: number | string;
      // Embedded relation comes back as either an object or an array
      // depending on how supabase-js infers the cardinality.
      customer_invoices:
        | { invoice_number: string }
        | { invoice_number: string }[]
        | null;
    };
    type RawPayment = {
      id: string;
      amount: number | string;
      method: string;
      reference_number: string | null;
      received_at: string;
      notes: string | null;
      customer_payment_applications: RawApplication[] | null;
    };

    const payments: PaymentRow[] = (
      (rawPayments ?? []) as unknown as RawPayment[]
    ).map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      method: row.method,
      reference_number: row.reference_number,
      received_at: row.received_at,
      notes: row.notes,
      applications: (row.customer_payment_applications ?? []).map((a) => {
        const inv = Array.isArray(a.customer_invoices)
          ? a.customer_invoices[0]
          : a.customer_invoices;
        return {
          invoice_id: a.invoice_id,
          invoice_number: inv?.invoice_number ?? "(deleted)",
          amount: Number(a.amount),
        };
      }),
    }));

    // Saved cards on file (Authorize.Net CIM-backed). RLS scopes by org.
    const { data: rawCards } = await supabase
      .from("customer_payment_profiles")
      .select(
        "id, card_type, card_last4, card_exp_month, card_exp_year, cardholder_name, is_default, created_at"
      )
      .eq("customer_id", id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    const savedCards: SavedCardRow[] = (rawCards ?? []).map((c) => ({
      id: c.id as string,
      card_type: c.card_type as string | null,
      card_last4: c.card_last4 as string | null,
      card_exp_month: c.card_exp_month as string | null,
      card_exp_year: c.card_exp_year as string | null,
      cardholder_name: c.cardholder_name as string | null,
      is_default: c.is_default as boolean,
      created_at: c.created_at as string,
    }));

    billing = { balance, creditAvailable, invoices, payments, savedCards };
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={16} /> Back to Customers
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
            {customer.contact_name && (
              <p className="text-sm text-gray-500">Contact: {customer.contact_name}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {customer.is_active ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                <CheckCircle size={14} /> Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-500">
                <XCircle size={14} /> Inactive
              </span>
            )}
            {canEdit && (
              <Link href={`/customers/${id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Pencil size={14} /> Edit
              </Link>
            )}
            <Link href={`/orders/new?customer=${id}`}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              + New Order
            </Link>
          </div>
        </div>
      </div>

      {/* Contact info cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {customer.email && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Mail size={16} /> <span className="text-xs font-medium uppercase">Email</span>
            </div>
            <p className="text-sm font-medium text-gray-900">{customer.email}</p>
          </div>
        )}
        {customer.phone && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Phone size={16} /> <span className="text-xs font-medium uppercase">Phone</span>
            </div>
            <p className="text-sm font-medium text-gray-900">{customer.phone}</p>
          </div>
        )}
        {(customer.city || customer.state) && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <MapPin size={16} /> <span className="text-xs font-medium uppercase">Location</span>
            </div>
            <p className="text-sm font-medium text-gray-900">
              {[customer.address, customer.city, customer.state, customer.zip].filter(Boolean).join(", ")}
            </p>
          </div>
        )}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Building2 size={16} /> <span className="text-xs font-medium uppercase">Revenue</span>
          </div>
          <p className="text-xl font-bold text-gray-900">${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-gray-400">{allOrders.length} orders</p>
        </div>
      </div>

      {/* Billing & Payments */}
      {billing && (
        <CustomerBillingPanel
          customerId={id}
          customerName={customer.name}
          balance={billing.balance}
          creditAvailable={billing.creditAvailable}
          invoices={billing.invoices}
          payments={billing.payments}
          savedCards={billing.savedCards}
          canManage={canManageBilling}
        />
      )}

      {/* Notes */}
      {customer.notes && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
          <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{customer.notes}</p>
        </div>
      )}

      {/* Order history */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Order History</h2>
        <p className="text-sm text-gray-500 mb-4">All orders from this customer</p>

        {allOrders.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No orders yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Order</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Date</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Items</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Total</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(allOrders as Array<{
                id: string;
                order_number: string;
                ordered_at: string;
                status: string;
                order_items: Array<{ quantity: number; unit_price: number }> | null;
              }>).map((order) => {
                const orderTotal = (order.order_items ?? []).reduce(
                  (s, item) => s + Number(item.quantity) * Number(item.unit_price),
                  0
                );
                const statusInfo = ORDER_STATUSES[order.status as keyof typeof ORDER_STATUSES];
                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <Link href="/orders" className="text-blue-600 hover:text-blue-800 font-medium">
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDate(order.ordered_at)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{(order.order_items || []).length}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      ${orderTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo?.color || "bg-gray-100 text-gray-800"}`}>
                        {statusInfo?.label || order.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="text-xs text-gray-400">
        Created {formatDate(customer.created_at)} · Last updated {formatDate(customer.updated_at)}
      </div>
    </div>
  );
}
