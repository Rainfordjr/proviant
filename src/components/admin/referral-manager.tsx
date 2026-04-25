"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Gift, Plus, Building2 } from "lucide-react";

interface Referral {
  id: string;
  referrer_org_id: string;
  referred_org_id: string;
  referral_code: string;
  status: string;
  credit_rate: number;
  total_credits_earned: number;
  created_at: string;
  referrer_org: { id: string; name: string } | null;
  referred_org: { id: string; name: string } | null;
}

interface Org {
  id: string;
  name: string;
  referral_code: string | null;
}

interface Props {
  referrals: Referral[];
  orgs: Org[];
}

export function ReferralManager({ referrals, orgs }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    referrer_org_id: "",
    referred_org_id: "",
    credit_rate: "0.10",
  });

  // Orgs that are already referred (can only be referred once)
  const referredOrgIds = new Set(referrals.map((r) => r.referred_org_id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.referrer_org_id || !form.referred_org_id) return;
    setSaving(true);

    await fetch("/api/admin/referrals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        referrer_org_id: form.referrer_org_id,
        referred_org_id: form.referred_org_id,
        credit_rate: parseFloat(form.credit_rate),
      }),
    });

    setSaving(false);
    setShowForm(false);
    setForm({ referrer_org_id: "", referred_org_id: "", credit_rate: "0.10" });
    router.refresh();
  };

  const totalCredits = referrals.reduce((sum, r) => sum + Number(r.total_credits_earned), 0);
  const activeReferrals = referrals.filter((r) => r.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs text-gray-500">Total Referrals</p>
          <p className="text-2xl font-bold text-white">{referrals.length}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-400">{activeReferrals}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs text-gray-500">Total Credits Issued</p>
          <p className="text-2xl font-bold text-purple-400">${totalCredits.toFixed(2)}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowForm(!showForm)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            showForm ? "bg-purple-600 text-white" : "bg-gray-800 text-purple-400 hover:bg-gray-700"
          }`}
        >
          <Plus size={12} className="inline mr-1" /> Create Referral
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-200">New Referral Relationship</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Referrer (earns credits)</label>
              <select
                required
                value={form.referrer_org_id}
                onChange={(e) => setForm({ ...form, referrer_org_id: e.target.value })}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-purple-500"
              >
                <option value="">Select organization…</option>
                {orgs
                  .filter((o) => o.id !== form.referred_org_id)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Referred Org (new customer)</label>
              <select
                required
                value={form.referred_org_id}
                onChange={(e) => setForm({ ...form, referred_org_id: e.target.value })}
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-purple-500"
              >
                <option value="">Select organization…</option>
                {orgs
                  .filter((o) => o.id !== form.referrer_org_id && !referredOrgIds.has(o.id))
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="max-w-xs">
            <label className="block text-xs text-gray-500 mb-1">Credit Rate (%)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="1.00"
              value={form.credit_rate}
              onChange={(e) => setForm({ ...form, credit_rate: e.target.value })}
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-purple-500"
            />
            <p className="text-[10px] text-gray-600 mt-1">
              0.10 = 10% — Referrer earns this percentage of each payment the referred org makes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create Referral"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Referrals list */}
      {referrals.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-800">
          <table className="min-w-full divide-y divide-gray-800">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referrer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referred Org</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rate</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credits Earned</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-900/50">
              {referrals.map((r) => (
                <tr key={r.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/organizations/${r.referrer_org_id}`}
                      className="text-sm font-medium text-purple-400 hover:text-purple-300"
                    >
                      <Building2 size={12} className="inline mr-1" />
                      {r.referrer_org?.name || "Unknown"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/organizations/${r.referred_org_id}`}
                      className="text-sm text-gray-300 hover:text-white"
                    >
                      {r.referred_org?.name || "Unknown"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-400">
                    {(r.credit_rate * 100).toFixed(0)}%
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-green-400">
                    ${Number(r.total_credits_earned).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.status === "active" ? "bg-green-500/20 text-green-400" :
                      r.status === "expired" ? "bg-red-500/20 text-red-400" :
                      "bg-gray-500/20 text-gray-400"
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
          <Gift size={32} className="mx-auto text-gray-600 mb-2" />
          <p className="text-sm text-gray-500">No referrals yet</p>
          <p className="text-xs text-gray-600">Create a referral relationship between two organizations above.</p>
        </div>
      )}
    </div>
  );
}
