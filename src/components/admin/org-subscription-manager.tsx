"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrgSubscription, Plan } from "@/types/database";

const statusOptions = ["active", "trial", "past_due", "cancelled", "suspended"] as const;

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-800",
  trial: "bg-blue-500/20 text-blue-400 border-blue-800",
  past_due: "bg-amber-500/20 text-amber-400 border-amber-800",
  cancelled: "bg-gray-500/20 text-gray-400 border-gray-700",
  suspended: "bg-red-500/20 text-red-400 border-red-800",
};

interface Props {
  orgId: string;
  subscription: (OrgSubscription & { plans?: Plan }) | null;
  plans: Plan[];
}

export function OrgSubscriptionManager({ orgId, subscription, plans }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [billingType, setBillingType] = useState<"plan" | "custom">(
    subscription?.billing_type || "custom"
  );
  const [planId, setPlanId] = useState<string>(subscription?.plan_id || "");
  const [customRate, setCustomRate] = useState<string>(
    subscription?.custom_rate_monthly?.toString() || "0"
  );
  const [customYearly, setCustomYearly] = useState<string>(
    subscription?.custom_rate_yearly?.toString() || ""
  );
  const [customNotes, setCustomNotes] = useState(subscription?.custom_notes || "");
  const [billingCycle, setBillingCycle] = useState(subscription?.billing_cycle || "monthly");
  const [status, setStatus] = useState(subscription?.status || "trial");

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);

    const payload: Record<string, any> = {
      org_id: orgId,
      billing_type: billingType,
      billing_cycle: billingCycle,
      status,
      updated_at: new Date().toISOString(),
    };

    if (billingType === "plan") {
      payload.plan_id = planId || null;
      payload.custom_rate_monthly = null;
      payload.custom_rate_yearly = null;
      payload.custom_notes = null;
    } else {
      payload.plan_id = null;
      payload.custom_rate_monthly = parseFloat(customRate) || 0;
      payload.custom_rate_yearly = customYearly ? parseFloat(customYearly) : null;
      payload.custom_notes = customNotes || null;
    }

    // Call our API route that uses service role
    const res = await fetch("/api/admin/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId,
        subscriptionId: subscription?.id || null,
        ...payload,
      }),
    });

    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    }
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Subscription</h2>
        {subscription && (
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColors[subscription.status] || ""}`}>
            {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1).replace("_", " ")}
          </span>
        )}
      </div>

      {/* Billing type toggle */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Billing Type</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setBillingType("plan")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              billingType === "plan"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Predefined Plan
          </button>
          <button
            type="button"
            onClick={() => setBillingType("custom")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              billingType === "custom"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Custom Rate
          </button>
        </div>
      </div>

      {/* Plan selector */}
      {billingType === "plan" && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">Select Plan</label>
          {plans.length === 0 ? (
            <p className="text-sm text-gray-500">No plans available. Create plans under Settings → Plans first.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setPlanId(plan.id)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    planId === plan.id
                      ? "border-blue-600 bg-blue-600/10"
                      : "border-gray-700 hover:border-gray-600"
                  }`}
                >
                  <p className="text-sm font-medium text-gray-200">{plan.name}</p>
                  <p className="text-lg font-bold text-white mt-1">
                    ${Number(plan.price_monthly).toFixed(2)}
                    <span className="text-xs text-gray-500 font-normal">/mo</span>
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Custom rate */}
      {billingType === "custom" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Monthly Rate ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={customRate}
                onChange={(e) => setCustomRate(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Yearly Rate ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={customYearly}
                onChange={(e) => setCustomYearly(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Optional"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              rows={2}
              placeholder="Internal notes about this custom deal"
            />
          </div>
        </div>
      )}

      {/* Billing cycle & status */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Billing Cycle</label>
          <select
            value={billingCycle}
            onChange={(e) => setBillingCycle(e.target.value as "monthly" | "yearly")}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500"
          >
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Subscription"}
        </button>
        {saved && (
          <span className="text-sm text-green-400">Saved successfully</span>
        )}
      </div>
    </div>
  );
}
