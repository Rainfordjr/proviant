"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRequirePermission } from "@/lib/usePermission";
import {
  CreditCard, Calendar, CheckCircle, AlertCircle, Clock,
  XCircle, FileText, Package, Plus, Gift, Copy, Check,
} from "lucide-react";
import Link from "next/link";
import type { OrgSubscription, Plan, BillingInvoice, Module, Referral } from "@/types/database";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  active:    { label: "Active",    color: "bg-green-50 text-green-700 border-green-200",  icon: CheckCircle },
  trial:     { label: "Trial",     color: "bg-blue-50 text-blue-700 border-blue-200",     icon: Clock },
  past_due:  { label: "Past Due",  color: "bg-amber-50 text-amber-700 border-amber-200",  icon: AlertCircle },
  cancelled: { label: "Cancelled", color: "bg-gray-50 text-gray-500 border-gray-200",     icon: XCircle },
  suspended: { label: "Suspended", color: "bg-red-50 text-red-700 border-red-200",        icon: XCircle },
};

const invoiceStatusColors: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700",
  paid: "bg-green-50 text-green-700",
  overdue: "bg-red-50 text-red-700",
  void: "bg-gray-50 text-gray-500",
};

export default function BillingPage() {
  const { loading: permLoading } = useRequirePermission("billing.view");
  const [subscription, setSubscription] = useState<(OrgSubscription & { plans?: Plan }) | null>(null);
  const [addons, setAddons] = useState<{ slug: string; name: string; price: number }[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // First get the user's org_id
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = user
        ? await supabase.from("users").select("org_id").eq("id", user.id).single()
        : { data: null };
      const orgId = profile?.org_id;

      const [
        { data: sub },
        { data: addonRows },
        { data: inv },
        { data: evtData },
        { data: orgData },
        { data: refData },
      ] = await Promise.all([
        supabase.from("org_subscriptions").select("*, plans(*)").maybeSingle(),
        supabase.from("subscription_addons").select("module_slug, modules(name, price_monthly)").eq("is_active", true),
        supabase.from("billing_invoices").select("*").order("period_end", { ascending: false }).limit(12),
        supabase.from("subscription_events").select("*").order("created_at", { ascending: false }).limit(10),
        orgId ? supabase.from("organizations").select("referral_code").eq("id", orgId).single() : { data: null },
        orgId ? supabase.from("referrals").select("*, referred_org:referred_org_id(name)").eq("referrer_org_id", orgId) : { data: null },
      ]);

      if (sub) setSubscription(sub);
      if (addonRows) {
        setAddons(
          addonRows.map((a: any) => ({
            slug: a.module_slug,
            name: (a.modules as any)?.name || a.module_slug,
            price: Number((a.modules as any)?.price_monthly || 0),
          }))
        );
      }
      if (inv) setInvoices(inv);
      if (evtData) setEvents(evtData);
      if (orgData?.referral_code) setReferralCode(orgData.referral_code);
      if (refData) setReferrals(refData);

      // Fetch ledger balance
      if (orgId) {
        const { data: bal } = await supabase.rpc("org_ledger_balance", { p_org_id: orgId });
        setBalance(Number(bal || 0));
      }

      setLoading(false);
    }
    load();
  }, []);

  if (permLoading || loading) {
    return <div className="p-8 text-center text-sm text-gray-500">Loading…</div>;
  }

  const planRate = subscription?.billing_type === "plan"
    ? Number(subscription.plans?.price_monthly || 0)
    : Number(subscription?.custom_rate_monthly || 0);
  const addonTotal = addons.reduce((sum, a) => sum + a.price, 0);
  const totalMonthly = planRate + addonTotal;

  const statusInfo = subscription ? statusConfig[subscription.status] || statusConfig.active : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
          <p className="text-sm text-gray-500">Your subscription and invoice history</p>
        </div>
        <Link
          href="/settings/plans"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Change Plan
        </Link>
      </div>

      {/* Account Balance */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Account Balance</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {balance > 0 ? "Amount owed" : balance < 0 ? "Credit on account" : "Account is settled"}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-bold ${
              balance > 0 ? "text-red-600" : balance < 0 ? "text-green-600" : "text-gray-600"
            }`}>
              {balance > 0 ? "" : balance < 0 ? "-" : ""}${Math.abs(balance).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Current Plan Summary */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Subscription</h2>

        {!subscription ? (
          <div className="text-center py-8">
            <CreditCard size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">No active subscription</p>
            <Link
              href="/settings/plans"
              className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Choose a plan →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-gray-900">
                  {subscription.billing_type === "custom"
                    ? "Custom Plan"
                    : subscription.plans?.name || "Unknown Plan"}
                </h3>
                {statusInfo && (
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}>
                    <statusInfo.icon size={12} />
                    {statusInfo.label}
                  </span>
                )}
              </div>
            </div>

            {/* Billing breakdown */}
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Monthly Breakdown
              </div>
              <div className="divide-y divide-gray-100">
                <div className="flex justify-between px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Package size={14} className="text-gray-400" />
                    <span>{subscription.plans?.name || "Custom"} plan</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">${planRate.toFixed(2)}</span>
                </div>
                {addons.map((addon) => (
                  <div key={addon.slug} className="flex justify-between px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Plus size={14} className="text-green-500" />
                      <span>{addon.name} add-on</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">${addon.price.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between px-4 py-3 bg-gray-50">
                  <span className="text-sm font-semibold text-gray-900">Monthly Total</span>
                  <span className="text-lg font-bold text-gray-900">${totalMonthly.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Period info */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 rounded-lg bg-gray-50 p-4 text-sm">
              <div>
                <p className="text-xs text-gray-500">Billing Cycle</p>
                <p className="font-medium text-gray-900 capitalize">{subscription.billing_cycle}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Current Period</p>
                <p className="font-medium text-gray-900">
                  {new Date(subscription.current_period_start).toLocaleDateString()} –{" "}
                  {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
              </div>
              {subscription.trial_ends_at && (
                <div>
                  <p className="text-xs text-gray-500">Trial Ends</p>
                  <p className="font-medium text-gray-900">
                    {new Date(subscription.trial_ends_at).toLocaleDateString()}
                  </p>
                </div>
              )}
              {subscription.plans?.max_users && (
                <div>
                  <p className="text-xs text-gray-500">Max Users</p>
                  <p className="font-medium text-gray-900">{subscription.plans.max_users}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Invoice History */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice History</h2>

        {invoices.length === 0 ? (
          <div className="text-center py-8">
            <FileText size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">No invoices yet</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(inv.period_start).toLocaleDateString()} –{" "}
                      {new Date(inv.period_end).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{inv.description || "Subscription"}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                      ${Number(inv.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${invoiceStatusColors[inv.status] || "bg-gray-50 text-gray-500"}`}>
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Subscription Change History */}
      {events.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Change History</h2>

          <div className="space-y-3">
            {events.map((evt: any) => (
              <div key={evt.id} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {evt.event_type.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(evt.created_at).toLocaleString()}
                  </span>
                </div>

                {evt.notes && (
                  <p className="text-xs text-gray-500">{evt.notes}</p>
                )}

                {evt.net_amount !== null && evt.net_amount !== 0 && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`text-xs font-medium ${
                      evt.net_amount > 0 ? "text-amber-600" : "text-green-600"
                    }`}>
                      {evt.net_amount > 0
                        ? `Prorated charge: $${Number(evt.net_amount).toFixed(2)}`
                        : `Prorated credit: $${Math.abs(Number(evt.net_amount)).toFixed(2)}`}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Referral Program */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Gift size={20} className="text-purple-500" />
          <h2 className="text-lg font-semibold text-gray-900">Referral Program</h2>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Share your referral code with other food manufacturers. When they sign up and make payments, you&apos;ll earn a 10% credit on each payment.
        </p>

        {referralCode && (
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 mb-4">
            <p className="text-xs text-purple-600 font-medium mb-1">Your Referral Code</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-mono font-bold text-purple-700">{referralCode}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(referralCode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 transition-colors"
              >
                {copied ? <><Check size={12} className="inline mr-1" /> Copied!</> : <><Copy size={12} className="inline mr-1" /> Copy</>}
              </button>
            </div>
          </div>
        )}

        {referrals.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Your Referrals</h3>
            <div className="space-y-2">
              {referrals.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.referred_org?.name || "Unknown"}</p>
                    <p className="text-xs text-gray-500">
                      Joined {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-green-600">${Number(r.total_credits_earned).toFixed(2)}</p>
                    <p className="text-[10px] text-gray-500">credits earned</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {referrals.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-3">
            No referrals yet. Share your code to start earning credits!
          </p>
        )}
      </div>
    </div>
  );
}
