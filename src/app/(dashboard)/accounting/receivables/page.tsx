import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import Link from "next/link";
import { ArrowRight, Wallet } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface OpenInvoiceRow {
  customer_id: string;
  total: number | string;
  issued_at: string;
  customer_payment_applications: { amount: number | string }[] | null;
}

interface AnyInvoiceRow {
  customer_id: string;
  total: number | string;
  status: string;
}

interface PaymentRow {
  customer_id: string;
  amount: number | string;
}

interface CustomerLite {
  id: string;
  name: string;
}

interface CustomerSummary {
  id: string;
  name: string;
  balance: number;
  open_invoice_count: number;
  oldest_open_at: string | null;
  /** "current" if no open invoices; otherwise one of the aging buckets. */
  bucket: "current" | "0-30" | "31-60" | "61-90" | "90+";
}

const BUCKET_ORDER: Array<CustomerSummary["bucket"]> = [
  "current",
  "0-30",
  "31-60",
  "61-90",
  "90+",
];

const BUCKET_LABEL: Record<CustomerSummary["bucket"], string> = {
  current: "Current / Settled",
  "0-30": "0–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "90+": "Over 90 days",
};

const BUCKET_STYLE: Record<CustomerSummary["bucket"], string> = {
  current: "bg-gray-100 text-gray-700",
  "0-30": "bg-amber-100 text-amber-800",
  "31-60": "bg-orange-100 text-orange-800",
  "61-90": "bg-red-100 text-red-800",
  "90+": "bg-red-200 text-red-900",
};

function ageBucket(oldestOpenAt: string | null): CustomerSummary["bucket"] {
  if (!oldestOpenAt) return "current";
  const ageDays =
    (Date.now() - new Date(oldestOpenAt).getTime()) / 86400000;
  if (ageDays <= 30) return "0-30";
  if (ageDays <= 60) return "31-60";
  if (ageDays <= 90) return "61-90";
  return "90+";
}

export default async function ReceivablesPage() {
  await requirePermission("customer_billing.view");

  const supabase = await createClient();

  // RLS on customers, customer_invoices, customer_payments restricts these
  // to the caller's org automatically.
  const [
    { data: customers },
    { data: allInvoices },
    { data: allPayments },
    { data: openInvoices },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name")
      .eq("is_active", true)
      .order("name") as unknown as Promise<{ data: CustomerLite[] | null }>,
    supabase
      .from("customer_invoices")
      .select("customer_id, total, status")
      .neq("status", "void") as unknown as Promise<{
      data: AnyInvoiceRow[] | null;
    }>,
    supabase
      .from("customer_payments")
      .select("customer_id, amount") as unknown as Promise<{
      data: PaymentRow[] | null;
    }>,
    supabase
      .from("customer_invoices")
      .select(
        "customer_id, total, issued_at, customer_payment_applications(amount)"
      )
      .in("status", ["open", "partial"])
      .eq("kind", "invoice") as unknown as Promise<{
      data: OpenInvoiceRow[] | null;
    }>,
  ]);

  // Aggregate balance per customer: sum(invoice.total non-void) - sum(payments).
  const balanceByCustomer = new Map<string, number>();
  for (const c of customers ?? []) balanceByCustomer.set(c.id, 0);
  for (const inv of allInvoices ?? []) {
    balanceByCustomer.set(
      inv.customer_id,
      (balanceByCustomer.get(inv.customer_id) ?? 0) + Number(inv.total)
    );
  }
  for (const p of allPayments ?? []) {
    balanceByCustomer.set(
      p.customer_id,
      (balanceByCustomer.get(p.customer_id) ?? 0) - Number(p.amount)
    );
  }

  // Per-customer open-invoice stats: count and oldest issued_at.
  const openCountByCustomer = new Map<string, number>();
  const oldestOpenByCustomer = new Map<string, string>();
  for (const inv of openInvoices ?? []) {
    openCountByCustomer.set(
      inv.customer_id,
      (openCountByCustomer.get(inv.customer_id) ?? 0) + 1
    );
    const existing = oldestOpenByCustomer.get(inv.customer_id);
    if (!existing || inv.issued_at < existing) {
      oldestOpenByCustomer.set(inv.customer_id, inv.issued_at);
    }
  }

  const summaries: CustomerSummary[] = (customers ?? []).map((c) => {
    const oldest = oldestOpenByCustomer.get(c.id) ?? null;
    return {
      id: c.id,
      name: c.name,
      balance: balanceByCustomer.get(c.id) ?? 0,
      open_invoice_count: openCountByCustomer.get(c.id) ?? 0,
      oldest_open_at: oldest,
      bucket: ageBucket(oldest),
    };
  });

  // Aging totals — sum of positive balances in each bucket
  const bucketTotals: Record<CustomerSummary["bucket"], number> = {
    current: 0,
    "0-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  };
  for (const s of summaries) {
    if (s.balance > 0) bucketTotals[s.bucket] += s.balance;
  }

  // Default sort: customers who owe most, descending. Negatives (credits) and
  // zeros at the bottom.
  const sorted = [...summaries].sort((a, b) => b.balance - a.balance);

  const totalAR = sorted.reduce(
    (sum, s) => sum + (s.balance > 0 ? s.balance : 0),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Accounts Receivable
        </h1>
        <p className="text-sm text-gray-500">
          Outstanding balances by customer, with aging across standard
          buckets.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Wallet size={16} />
            <span className="text-xs font-medium uppercase">Total A/R</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${totalAR.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400">
            Across {summaries.filter((s) => s.balance > 0).length} customers
          </p>
        </div>

        {(BUCKET_ORDER.filter((b) => b !== "current") as Array<
          CustomerSummary["bucket"]
        >).map((b) => (
          <div
            key={b}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${BUCKET_STYLE[b]}`}
            >
              {BUCKET_LABEL[b]}
            </span>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              ${bucketTotals[b].toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Open Invoices
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Oldest Open
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Aging
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                Balance
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-8 text-center text-sm text-gray-500"
                >
                  No customers yet.
                </td>
              </tr>
            ) : (
              sorted.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">
                    <Link
                      href={`/customers/${s.id}`}
                      className="hover:text-blue-700"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-700">
                    {s.open_invoice_count > 0 ? s.open_invoice_count : "—"}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-700">
                    {s.oldest_open_at ? formatDate(s.oldest_open_at) : "—"}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        BUCKET_STYLE[s.bucket]
                      }`}
                    >
                      {BUCKET_LABEL[s.bucket]}
                    </span>
                  </td>
                  <td
                    className={`px-6 py-3 text-right text-sm font-semibold ${
                      s.balance > 0
                        ? "text-red-700"
                        : s.balance < 0
                        ? "text-green-700"
                        : "text-gray-500"
                    }`}
                  >
                    {s.balance < 0 ? "-" : ""}$
                    {Math.abs(s.balance).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Link
                      href={`/customers/${s.id}`}
                      className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
                    >
                      Open <ArrowRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
