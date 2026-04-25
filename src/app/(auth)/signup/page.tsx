"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Check } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number | null;
  max_users: number | null;
  max_batches_per_month: number | null;
  included_modules: string[];
  is_featured: boolean;
  badge: string | null;
  sort_order: number;
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    async function loadPlans() {
      try {
        const res = await fetch("/api/plans");
        const data = await res.json();
        if (data.plans) {
          setPlans(data.plans);
          // Auto-select the featured plan
          const featured = data.plans.find((p: Plan) => p.is_featured);
          if (featured) setSelectedPlanId(featured.id);
        }
      } catch {
        // Plans will just be empty
      }
      setPlansLoading(false);
    }
    loadPlans();
  }, []);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) {
      setError("Please select a plan.");
      return;
    }
    setLoading(true);
    setError(null);

    let data: any;
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          fullName,
          orgName,
          planId: selectedPlanId,
          referralCode: referralCode || undefined,
        }),
      });

      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        setError("Server error: " + text.slice(0, 200));
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || "Signup failed. Please try again.");
        setLoading(false);
        return;
      }
    } catch (fetchErr: any) {
      setError("Network error: " + (fetchErr?.message || "Could not reach server"));
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("Account created but failed to sign in: " + signInError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-3 text-sm">
        <span className={`flex items-center gap-1.5 ${step === 1 ? "text-blue-600 font-semibold" : "text-gray-400"}`}>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
            step === 1 ? "bg-blue-600 text-white" : step === 2 ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
          }`}>
            {step > 1 ? <Check size={14} /> : "1"}
          </span>
          Choose plan
        </span>
        <div className="h-px w-8 bg-gray-300" />
        <span className={`flex items-center gap-1.5 ${step === 2 ? "text-blue-600 font-semibold" : "text-gray-400"}`}>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
            step === 2 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
          }`}>
            2
          </span>
          Create account
        </span>
      </div>

      {/* Step 1: Plan Selection */}
      {step === 1 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 text-center">Choose your plan</h2>
          <p className="mt-1 text-sm text-gray-500 text-center">
            All plans include a 14-day free trial. No payment required today.
          </p>

          {plansLoading ? (
            <div className="py-12 text-center text-sm text-gray-500">Loading plans…</div>
          ) : plans.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">No plans available</div>
          ) : (
            <div className="mt-6 grid gap-4">
              {plans.map((plan) => {
                const isSelected = selectedPlanId === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`relative w-full rounded-xl border-2 p-4 text-left transition-all ${
                      isSelected
                        ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                    }`}
                  >
                    {/* Badge */}
                    {plan.badge && (
                      <span className="absolute -top-2.5 right-4 rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        {plan.badge}
                      </span>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Radio indicator */}
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                          isSelected ? "border-blue-600 bg-blue-600" : "border-gray-300"
                        }`}>
                          {isSelected && <Check size={12} className="text-white" />}
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">{plan.name}</h3>
                          {plan.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{plan.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-gray-900">
                          ${plan.price_monthly.toFixed(2)}
                        </span>
                        <span className="text-sm text-gray-500">/mo</span>
                      </div>
                    </div>

                    {/* Limits */}
                    <div className="mt-3 flex gap-4 text-xs text-gray-500 ml-8">
                      {plan.max_users && (
                        <span>Up to {plan.max_users} users</span>
                      )}
                      {!plan.max_users && <span>Unlimited users</span>}
                      {plan.max_batches_per_month && (
                        <span>· {plan.max_batches_per_month} batches/mo</span>
                      )}
                      {!plan.max_batches_per_month && <span>· Unlimited batches</span>}
                      <span>· {plan.included_modules?.length || 0} modules</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            disabled={!selectedPlanId}
            onClick={() => setStep(2)}
            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue with {selectedPlan?.name || "selected plan"}
          </button>

          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-800">
              Sign in
            </Link>
          </p>
        </div>
      )}

      {/* Step 2: Account Details */}
      {step === 2 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {/* Selected plan summary */}
          {selectedPlan && (
            <div className="mb-5 flex items-center justify-between rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Check size={16} className="text-blue-600" />
                <span className="text-sm font-medium text-blue-900">{selectedPlan.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-blue-900">${selectedPlan.price_monthly.toFixed(2)}/mo</span>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Change
                </button>
              </div>
            </div>
          )}

          <h2 className="text-xl font-semibold text-gray-900">Create your account</h2>
          <p className="mt-1 text-sm text-gray-500">
            Start your 14-day free trial. No payment required.
          </p>

          <form onSubmit={handleSignup} className="mt-5 space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="orgName" className="block text-sm font-medium text-gray-700">
                Company name
              </label>
              <input
                id="orgName"
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Your bakery or food company"
              />
            </div>

            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                Your full name
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Billy Rainford"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="At least 6 characters"
              />
            </div>

            <div>
              <label htmlFor="referralCode" className="block text-sm font-medium text-gray-700">
                Referral code <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                id="referralCode"
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. ABCD-1234"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating account..." : "Start free trial"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-800">
              Sign in
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
