"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRequirePermission } from "@/lib/usePermission";
import {
  Check, X, Star, Users, Package, Lock, Plus, Minus, Crown,
} from "lucide-react";
import type { Plan, Module, OrgSubscription } from "@/types/database";

export default function PlansPage() {
  const { loading: permLoading } = useRequirePermission("billing.manage");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [subscription, setSubscription] = useState<(OrgSubscription & { plans?: Plan }) | null>(null);
  const [addons, setAddons] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [
        { data: plansData },
        { data: modulesData },
        { data: subData },
        { data: addonsData },
      ] = await Promise.all([
        supabase.from("plans").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("modules").select("*").eq("is_core", false).order("sort_order"),
        supabase.from("org_subscriptions").select("*, plans(*)").maybeSingle(),
        supabase.from("subscription_addons").select("*").eq("is_active", true),
      ]);

      if (plansData) setPlans(plansData);
      if (modulesData) setModules(modulesData);
      if (subData) setSubscription(subData);
      if (addonsData) {
        setAddons(new Set(addonsData.map((a: any) => a.module_slug)));
      }
      setLoading(false);
    }
    load();
  }, []);

  const currentPlanId = subscription?.plan_id;

  const [prorationInfo, setProrationInfo] = useState<{
    creditAmount: number;
    chargeAmount: number;
    netAmount: number;
    daysRemaining: number;
  } | null>(null);

  const selectPlan = async (planId: string) => {
    // UI-level guard: a rapid second click while the first is still in flight
    // would otherwise queue a duplicate POST.
    if (saving) return;
    setSaving(true);
    setProrationInfo(null);

    // Idempotency-Key prevents the server from applying the same plan change
    // twice if the request is somehow retried at the network layer. We mint
    // a fresh key per intent (each call to selectPlan).
    const idempotencyKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const res = await fetch("/api/billing/change-plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ newPlanId: planId }),
    });

    const data = await res.json();

    if (res.ok) {
      if (data.proration) {
        setProrationInfo(data.proration);
      }

      // Reload subscription
      const supabase = createClient();
      const { data: subData } = await supabase
        .from("org_subscriptions")
        .select("*, plans(*)")
        .maybeSingle();
      if (subData) setSubscription(subData);
    }

    setSaving(false);
  };

  const toggleAddon = async (slug: string) => {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("users")
      .select("org_id")
      .eq("id", user!.id)
      .single();

    const isCurrentlyActive = addons.has(slug);

    if (isCurrentlyActive) {
      await supabase
        .from("subscription_addons")
        .update({ is_active: false, deactivated_at: new Date().toISOString() })
        .eq("org_id", profile!.org_id)
        .eq("module_slug", slug);
      setAddons((prev) => {
        const next = new Set(prev);
        next.delete(slug);
        return next;
      });
    } else {
      // Upsert
      const { data: existing } = await supabase
        .from("subscription_addons")
        .select("id")
        .eq("org_id", profile!.org_id)
        .eq("module_slug", slug)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("subscription_addons")
          .update({ is_active: true, activated_at: new Date().toISOString(), deactivated_at: null })
          .eq("id", existing.id);
      } else {
        await supabase.from("subscription_addons").insert({
          org_id: profile!.org_id,
          module_slug: slug,
        });
      }
      setAddons((prev) => new Set([...prev, slug]));
    }
    setSaving(false);
  };

  // Which modules are included in the current plan?
  const includedInPlan = new Set(subscription?.plans?.included_modules || []);

  // Extra modules available as add-ons (not core, not already in the plan)
  const availableAddons = modules.filter(
    (m) => !m.is_core && !includedInPlan.has(m.slug)
  );

  // Calculate monthly total
  const planRate = subscription?.billing_type === "plan"
    ? Number(subscription.plans?.price_monthly || 0)
    : Number(subscription?.custom_rate_monthly || 0);
  const addonTotal = modules
    .filter((m) => addons.has(m.slug) && !includedInPlan.has(m.slug))
    .reduce((sum, m) => sum + Number(m.price_monthly || 0), 0);

  if (permLoading || loading) {
    return <div className="p-8 text-center text-sm text-gray-500">Loading…</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Plans & Pricing</h1>
        <p className="text-sm text-gray-500">
          Choose a plan and add extra modules as needed
        </p>
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = currentPlanId === plan.id;
          const included = plan.included_modules || [];

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 p-6 transition-colors ${
                isCurrent
                  ? "border-blue-500 bg-blue-50/30 shadow-lg"
                  : plan.is_featured
                    ? "border-blue-200 bg-white shadow-md"
                    : "border-gray-200 bg-white"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                    <Star size={12} /> {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                {plan.description && (
                  <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                )}
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">
                    ${Number(plan.price_monthly).toFixed(2)}
                  </span>
                  <span className="text-sm text-gray-500">/month</span>
                </div>
                {plan.price_yearly && (
                  <p className="text-xs text-gray-500 mt-1">
                    or ${Number(plan.price_yearly).toFixed(2)}/year (save {Math.round((1 - Number(plan.price_yearly) / (Number(plan.price_monthly) * 12)) * 100)}%)
                  </p>
                )}
              </div>

              {/* Limits */}
              <div className="space-y-2 mb-6 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Users size={14} className="text-gray-400" />
                  <span>{plan.max_users ? `Up to ${plan.max_users} users` : "Unlimited users"}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Package size={14} className="text-gray-400" />
                  <span>
                    {plan.max_batches_per_month
                      ? `${plan.max_batches_per_month} batches/month`
                      : "Unlimited batches"}
                  </span>
                </div>
              </div>

              {/* Included modules */}
              <div className="space-y-1.5 mb-6 border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Included Modules</p>
                {included.map((slug) => {
                  const mod = modules.find((m) => m.slug === slug);
                  return (
                    <div key={slug} className="flex items-center gap-2 text-sm text-gray-700">
                      <Check size={14} className="text-green-500" />
                      <span>{mod?.name || slug}</span>
                    </div>
                  );
                })}
                {/* Show what's NOT included */}
                {modules
                  .filter((m) => !m.is_core && !included.includes(m.slug))
                  .map((m) => (
                    <div key={m.slug} className="flex items-center gap-2 text-sm text-gray-400">
                      <X size={14} className="text-gray-300" />
                      <span>{m.name}</span>
                    </div>
                  ))}
              </div>

              <button
                onClick={() => selectPlan(plan.id)}
                disabled={saving || isCurrent}
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                  isCurrent
                    ? "bg-blue-100 text-blue-700 cursor-default"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {isCurrent ? "Current Plan" : saving ? "Updating…" : "Select Plan"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Add-on Modules */}
      {availableAddons.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Module Add-ons</h2>
          <p className="text-sm text-gray-500 mb-4">
            Add extra modules on top of your plan for an additional monthly fee
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availableAddons.map((mod) => {
              const isAddonActive = addons.has(mod.slug);
              return (
                <div
                  key={mod.slug}
                  className={`rounded-lg border p-4 transition-colors ${
                    isAddonActive
                      ? "border-green-300 bg-green-50/30"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{mod.name}</h3>
                      {mod.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{mod.description}</p>
                      )}
                    </div>
                    <span className="text-sm font-bold text-gray-900">
                      ${Number(mod.price_monthly || 0).toFixed(2)}
                      <span className="text-xs text-gray-500 font-normal">/mo</span>
                    </span>
                  </div>
                  <button
                    onClick={() => toggleAddon(mod.slug)}
                    disabled={saving}
                    className={`mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      isAddonActive
                        ? "bg-white border border-gray-300 text-gray-700 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                        : "bg-green-600 text-white hover:bg-green-700"
                    }`}
                  >
                    {isAddonActive ? (
                      <><Minus size={12} /> Remove Add-on</>
                    ) : (
                      <><Plus size={12} /> Add Module</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Proration notice */}
      {prorationInfo && prorationInfo.netAmount !== 0 && (
        <div className={`rounded-xl border p-4 ${
          prorationInfo.netAmount > 0
            ? "border-amber-200 bg-amber-50"
            : "border-green-200 bg-green-50"
        }`}>
          <h3 className={`text-sm font-semibold mb-2 ${
            prorationInfo.netAmount > 0 ? "text-amber-900" : "text-green-900"
          }`}>
            Plan Change — Proration Applied
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Credit for {prorationInfo.daysRemaining} unused days on previous plan</span>
              <span className="text-green-700">-${prorationInfo.creditAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Charge for {prorationInfo.daysRemaining} days on new plan</span>
              <span className="text-gray-900">${prorationInfo.chargeAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
              <span className="font-semibold text-gray-900">
                {prorationInfo.netAmount > 0 ? "Amount due" : "Credit applied"}
              </span>
              <span className={`font-bold ${prorationInfo.netAmount > 0 ? "text-amber-700" : "text-green-700"}`}>
                {prorationInfo.netAmount > 0 ? "" : "-"}${Math.abs(prorationInfo.netAmount).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Monthly summary */}
      {subscription && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Monthly Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">
                {subscription.plans?.name || "Custom"} plan
              </span>
              <span className="font-medium text-gray-900">${planRate.toFixed(2)}</span>
            </div>
            {modules
              .filter((m) => addons.has(m.slug) && !includedInPlan.has(m.slug))
              .map((m) => (
                <div key={m.slug} className="flex justify-between">
                  <span className="text-gray-600">{m.name} add-on</span>
                  <span className="font-medium text-gray-900">
                    ${Number(m.price_monthly || 0).toFixed(2)}
                  </span>
                </div>
              ))}
            <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="font-bold text-gray-900 text-lg">
                ${(planRate + addonTotal).toFixed(2)}/mo
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
