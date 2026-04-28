"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LedgerEntry } from "@/types/database";
import {
  ArrowUpRight, ArrowDownLeft, Gift, RefreshCw, Minus, Plus,
} from "lucide-react";

const entryTypeConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  charge:          { label: "Charge",          color: "text-red-400",    icon: ArrowUpRight },
  payment:         { label: "Payment",         color: "text-green-400",  icon: ArrowDownLeft },
  credit:          { label: "Credit",          color: "text-blue-400",   icon: Gift },
  referral_credit: { label: "Referral Credit", color: "text-purple-400", icon: Gift },
  adjustment:      { label: "Adjustment",      color: "text-amber-400",  icon: RefreshCw },
  refund:          { label: "Refund",          color: "text-orange-400", icon: Minus },
};

interface Props {
  orgId: string;
  entries: LedgerEntry[];
  balance: number;
  invoices: { id: string; description: string | null; amount: number; status: string; period_start: string; period_end: string }[];
}

export function OrgLedger({ orgId, entries, balance, invoices }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState<"charge" | "payment" | "credit" | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    amount: "",
    description: "",
    reference_number: "",
    notes: "",
    invoice_id: "",
  });

  const resetForm = () => {
    setForm({ amount: "", description: "", reference_number: "", notes: "", invoice_id: "" });
    setShowForm(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // UI-level guard against double-submits while a request is in flight.
    if (saving) return;
    setSaving(true);

    const amount = parseFloat(form.amount);
    if (!amount || !form.description) {
      setSaving(false);
      return;
    }

    // Fresh Idempotency-Key per submission. If a network retry replays this
    // POST, the server will dedup against this key.
    const idempotencyKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    if (showForm === "payment") {
      // Use the record-payment route (handles referral credits automatically)
      await fetch("/api/admin/record-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          org_id: orgId,
          amount,
          description: form.description,
          reference_number: form.reference_number || null,
          notes: form.notes || null,
          invoice_id: form.invoice_id || null,
        }),
      });
    } else {
      // Use the general ledger route
      const entryAmount = showForm === "credit" ? -Math.abs(amount) : Math.abs(amount);
      await fetch("/api/admin/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          entry_type: showForm,
          amount: entryAmount,
          description: form.description,
          reference_number: form.reference_number || null,
          notes: form.notes || null,
          invoice_id: form.invoice_id || null,
        }),
      });
    }

    setSaving(false);
    resetForm();
    router.refresh();
  };

  const unpaidInvoices = invoices.filter((i) => i.status === "pending" || i.status === "overdue");

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Ledger</h2>
          <p className="text-sm text-gray-500">{entries.length} entries</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Current Balance</p>
          <p className={`text-2xl font-bold ${balance > 0 ? "text-red-400" : balance < 0 ? "text-green-400" : "text-gray-300"}`}>
            {balance > 0 ? "" : balance < 0 ? "-" : ""}${Math.abs(balance).toFixed(2)}
          </p>
          <p className="text-[10px] text-gray-600">
            {balance > 0 ? "Amount owed" : balance < 0 ? "Credit on account" : "Settled"}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowForm(showForm === "charge" ? null : "charge")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            showForm === "charge" ? "bg-red-600 text-white" : "bg-gray-800 text-red-400 hover:bg-gray-700"
          }`}
        >
          <Plus size={12} className="inline mr-1" /> Add Charge
        </button>
        <button
          onClick={() => setShowForm(showForm === "payment" ? null : "payment")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            showForm === "payment" ? "bg-green-600 text-white" : "bg-gray-800 text-green-400 hover:bg-gray-700"
          }`}
        >
          <ArrowDownLeft size={12} className="inline mr-1" /> Record Payment
        </button>
        <button
          onClick={() => setShowForm(showForm === "credit" ? null : "credit")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            showForm === "credit" ? "bg-blue-600 text-white" : "bg-gray-800 text-blue-400 hover:bg-gray-700"
          }`}
        >
          <Gift size={12} className="inline mr-1" /> Apply Credit
        </button>
      </div>

      {/* Entry form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-gray-700 bg-gray-800 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-200 capitalize">
            {showForm === "charge" ? "Add Charge" : showForm === "payment" ? "Record Payment" : "Apply Credit"}
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount ($) *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-blue-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Reference #</label>
              <input
                value={form.reference_number}
                onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-blue-500"
                placeholder="Check #, transaction ID"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Description *</label>
            <input
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-blue-500"
              placeholder={
                showForm === "charge" ? "e.g. April 2026 subscription" :
                showForm === "payment" ? "e.g. Wire transfer received" :
                "e.g. Goodwill credit for downtime"
              }
            />
          </div>

          {/* Link to invoice (for payments) */}
          {showForm === "payment" && unpaidInvoices.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Apply to Invoice</label>
              <select
                value={form.invoice_id}
                onChange={(e) => setForm({ ...form, invoice_id: e.target.value })}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-blue-500"
              >
                <option value="">None (general payment)</option>
                {unpaidInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    ${Number(inv.amount).toFixed(2)} — {inv.description || `${new Date(inv.period_start).toLocaleDateString()} – ${new Date(inv.period_end).toLocaleDateString()}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-blue-500"
              rows={2}
              placeholder="Internal notes"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Entry"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Ledger table */}
      {entries.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-gray-800">
          <table className="min-w-full divide-y divide-gray-800">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {entries.map((entry) => {
                const config = entryTypeConfig[entry.entry_type] || entryTypeConfig.charge;
                const Icon = config.icon;
                return (
                  <tr key={entry.id} className="hover:bg-gray-800/50">
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${config.color}`}>
                        <Icon size={12} /> {config.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-sm text-gray-300">{entry.description}</p>
                      {entry.reference_number && (
                        <p className="text-[10px] text-gray-600">Ref: {entry.reference_number}</p>
                      )}
                      {entry.notes && (
                        <p className="text-[10px] text-gray-600 italic">{entry.notes}</p>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-sm text-right font-medium ${
                      entry.amount > 0 ? "text-red-400" : "text-green-400"
                    }`}>
                      {entry.amount > 0 ? "+" : ""}{Number(entry.amount).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-sm text-right text-gray-400">
                      {entry.running_balance != null ? `$${Number(entry.running_balance).toFixed(2)}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-500 text-center py-4">No ledger entries yet</p>
      )}
    </div>
  );
}
