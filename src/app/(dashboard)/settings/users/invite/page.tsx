"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, User, Shield, Copy, Check } from "lucide-react";
import { useRequireAdmin } from "@/lib/usePermission";

interface Role {
  id: string;
  name: string;
  is_admin: boolean;
}

export default function InviteUserPage() {
  const { loading: permLoading } = useRequireAdmin();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [result, setResult] = useState<{
    email: string;
    fullName: string;
    tempPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Form fields
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [roleId, setRoleId] = useState("");

  // Load available roles
  useEffect(() => {
    async function loadRoles() {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("roles")
        .select("id, name, is_admin")
        .order("name");
      if (data) setRoles(data);
    }
    loadRoles();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName, roleId: roleId || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to invite user");
        return;
      }

      setResult({
        email: data.user.email,
        fullName: data.user.fullName,
        tempPassword: data.tempPassword,
      });
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  function copyCredentials() {
    if (!result) return;
    const text = `Login credentials for ${result.email}:\nEmail: ${result.email}\nTemporary Password: ${result.tempPassword}\nLogin at: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (permLoading) return <div className="p-8 text-center text-sm text-gray-500">Checking permissions…</div>;

  // Success state — show credentials
  if (result) {
    return (
      <div className="space-y-6">
        <Link
          href="/settings/users"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={16} /> Back to Users
        </Link>

        <div className="rounded-xl border border-green-200 bg-green-50 p-6">
          <h2 className="text-lg font-semibold text-green-900 mb-2">
            User invited successfully!
          </h2>
          <p className="text-sm text-green-800 mb-4">
            Share these login credentials with <strong>{result.fullName}</strong>.
            They should change their password after first login.
          </p>

          <div className="rounded-lg border border-green-200 bg-white p-4 space-y-2 font-mono text-sm">
            <div>
              <span className="text-gray-500">Email:</span>{" "}
              <span className="text-gray-900">{result.email}</span>
            </div>
            <div>
              <span className="text-gray-500">Temporary Password:</span>{" "}
              <span className="text-gray-900">{result.tempPassword}</span>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={copyCredentials}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copied!" : "Copy Credentials"}
            </button>
            <Link
              href="/settings/users"
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back to Users
            </Link>
            <button
              onClick={() => {
                setResult(null);
                setEmail("");
                setFullName("");
                setRoleId("");
              }}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Invite Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Form state
  return (
    <div className="space-y-6">
      <Link
        href="/settings/users"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> Back to Users
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Invite User</h1>
        <p className="text-sm text-gray-500">
          Add a new team member to your organization
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Mail size={14} className="inline mr-1" />
              Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="newuser@company.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User size={14} className="inline mr-1" />
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              If left blank, the part before @ in their email will be used.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Shield size={14} className="inline mr-1" />
              Initial Role
            </label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">No role (assign later)</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                  {role.is_admin ? " (Admin)" : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              You can assign additional roles from the Users page after creation.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Inviting…" : "Invite User"}
          </button>
          <Link
            href="/settings/users"
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
