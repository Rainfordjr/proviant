"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CreditCard, Building2, CheckCircle, XCircle } from "lucide-react";
import { useRequirePermission } from "@/lib/usePermission";

interface Settings {
  auth_net_environment: "sandbox" | "production";
  auth_net_api_login_id: string;
  auth_net_transaction_key: string;
  auth_net_public_client_key: string;
  auth_net_configured: boolean;

  bill_dot_com_environment: "sandbox" | "production";
  bill_dot_com_username: string;
  bill_dot_com_password: string;
  bill_dot_com_dev_key: string;
  bill_dot_com_org_id: string;
  bill_dot_com_configured: boolean;
}

const EMPTY: Settings = {
  auth_net_environment: "sandbox",
  auth_net_api_login_id: "",
  auth_net_transaction_key: "",
  auth_net_public_client_key: "",
  auth_net_configured: false,
  bill_dot_com_environment: "sandbox",
  bill_dot_com_username: "",
  bill_dot_com_password: "",
  bill_dot_com_dev_key: "",
  bill_dot_com_org_id: "",
  bill_dot_com_configured: false,
};

export default function PaymentGatewaysSettingsPage() {
  const { loading: permLoading } = useRequirePermission("customer_billing.manage");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(EMPTY);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/customer-billing/gateway-settings");
      if (res.ok) {
        const data = (await res.json()) as { settings: Settings };
        setSettings(data.settings);
      }
      setLoading(false);
    };
    load();
  }, []);

  const update = (patch: Partial<Settings>) =>
    setSettings((s) => ({ ...s, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    // Send only the editable fields. Backend treats masked placeholders
    // (••••••XXXX) as "leave unchanged" so re-saving without retyping a
    // secret won't wipe it.
    const res = await fetch("/api/customer-billing/gateway-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_net_environment: settings.auth_net_environment,
        auth_net_api_login_id: settings.auth_net_api_login_id,
        auth_net_transaction_key: settings.auth_net_transaction_key,
        auth_net_public_client_key: settings.auth_net_public_client_key,

        bill_dot_com_environment: settings.bill_dot_com_environment,
        bill_dot_com_dev_key: settings.bill_dot_com_dev_key,
        bill_dot_com_username: settings.bill_dot_com_username,
        bill_dot_com_password: settings.bill_dot_com_password,
        bill_dot_com_org_id: settings.bill_dot_com_org_id,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(data?.error ?? "Failed to save");
      setSaving(false);
      return;
    }

    setSuccess("Settings saved.");
    setSaving(false);

    // Re-fetch so the masked secrets reflect the new state.
    const reload = await fetch("/api/customer-billing/gateway-settings");
    if (reload.ok) {
      const reloaded = (await reload.json()) as { settings: Settings };
      setSettings(reloaded.settings);
    }
  };

  if (permLoading || loading) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">Loading…</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={16} /> Back to Settings
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Payment Gateways</h1>
        <p className="text-sm text-gray-500">
          Connect Authorize.Net (cards) and Bill.com (ACH) so you can accept
          customer payments directly. Credentials are stored per organization
          and used only by the server when you initiate a payment.
        </p>
      </div>

      <form onSubmit={save} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {/* Authorize.Net */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <CreditCard size={20} className="text-gray-500" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Authorize.Net
                </h2>
                <p className="text-sm text-gray-500">
                  Used for credit and debit card payments.
                </p>
              </div>
            </div>
            {settings.auth_net_configured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                <CheckCircle size={12} /> Configured
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
                <XCircle size={12} /> Not configured
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Environment
              </label>
              <select
                value={settings.auth_net_environment}
                onChange={(e) =>
                  update({
                    auth_net_environment: e.target.value as "sandbox" | "production",
                  })
                }
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Public Client Key
              </label>
              <input
                type="text"
                value={settings.auth_net_public_client_key}
                onChange={(e) =>
                  update({ auth_net_public_client_key: e.target.value })
                }
                placeholder="Required by Accept.js in the browser"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                API Login ID <span className="text-xs text-gray-400">(secret)</span>
              </label>
              <input
                type="text"
                value={settings.auth_net_api_login_id}
                onChange={(e) =>
                  update({ auth_net_api_login_id: e.target.value })
                }
                placeholder="Leave masked to keep current"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Transaction Key <span className="text-xs text-gray-400">(secret)</span>
              </label>
              <input
                type="text"
                value={settings.auth_net_transaction_key}
                onChange={(e) =>
                  update({ auth_net_transaction_key: e.target.value })
                }
                placeholder="Leave masked to keep current"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Bill.com */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Building2 size={20} className="text-gray-500" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Bill.com</h2>
                <p className="text-sm text-gray-500">
                  Used for ACH bank transfers. Note: the live Bill.com submission
                  is not yet wired in v1 — recorded ACH payments stay in the
                  &quot;pending&quot; state until you mark them cleared.
                </p>
              </div>
            </div>
            {settings.bill_dot_com_configured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                <CheckCircle size={12} /> Configured
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
                <XCircle size={12} /> Not configured
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Environment
              </label>
              <select
                value={settings.bill_dot_com_environment}
                onChange={(e) =>
                  update({
                    bill_dot_com_environment: e.target.value as
                      | "sandbox"
                      | "production",
                  })
                }
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Bill.com Org ID
              </label>
              <input
                type="text"
                value={settings.bill_dot_com_org_id}
                onChange={(e) =>
                  update({ bill_dot_com_org_id: e.target.value })
                }
                placeholder="Returned on first Login.json call"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                type="text"
                value={settings.bill_dot_com_username}
                onChange={(e) =>
                  update({ bill_dot_com_username: e.target.value })
                }
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Password <span className="text-xs text-gray-400">(secret)</span>
              </label>
              <input
                type="text"
                value={settings.bill_dot_com_password}
                onChange={(e) =>
                  update({ bill_dot_com_password: e.target.value })
                }
                placeholder="Leave masked to keep current"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Developer Key <span className="text-xs text-gray-400">(secret)</span>
            </label>
            <input
              type="text"
              value={settings.bill_dot_com_dev_key}
              onChange={(e) => update({ bill_dot_com_dev_key: e.target.value })}
              placeholder="Leave masked to keep current"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
