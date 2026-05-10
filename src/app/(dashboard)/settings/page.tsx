"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Lock, User, Building2, Factory } from "lucide-react";

export default function SettingsPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [profileMsg, setProfileMsg] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  const [orgId, setOrgId] = useState<string | null>(null);
  const [productionMode, setProductionMode] = useState<"controlled" | "after_action">("after_action");
  const [orgMsg, setOrgMsg] = useState("");
  const [orgError, setOrgError] = useState("");
  const [loadingOrg, setLoadingOrg] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        setEmail(authUser.email || "");

        const { data: profile } = await supabase
          .from("users")
          .select("full_name, org_id")
          .eq("id", authUser.id)
          .single();

        if (profile) {
          setFullName(profile.full_name || "");

          const { data: org } = await supabase
            .from("organizations")
            .select("name, production_mode")
            .eq("id", profile.org_id)
            .single();

          if (org) {
            setOrgName(org.name);
            setOrgId(profile.org_id);
            const mode = (org as { production_mode?: string }).production_mode;
            if (mode === "controlled" || mode === "after_action") {
              setProductionMode(mode);
            }
          }
        }
      }
    }
    load();
  }, []);

  async function handleOrgUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setLoadingOrg(true);
    setOrgMsg("");
    setOrgError("");
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("organizations")
        .update({ production_mode: productionMode })
        .eq("id", orgId);
      if (error) {
        setOrgError(error.message);
      } else {
        setOrgMsg("Organization settings saved.");
      }
    } finally {
      setLoadingOrg(false);
    }
  }

  async function handleProfileUpdate(e: React.FormEvent) {
    e.preventDefault();
    setLoadingProfile(true);
    setProfileMsg("");
    setProfileError("");

    try {
      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        setProfileError("Not authenticated");
        return;
      }

      const { error } = await supabase
        .from("users")
        .update({ full_name: fullName })
        .eq("id", authUser.id);

      if (error) {
        setProfileError(error.message);
      } else {
        setProfileMsg("Profile updated.");
      }
    } finally {
      setLoadingProfile(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setLoadingPassword(true);
    setPasswordMsg("");
    setPasswordError("");

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      setLoadingPassword(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      setLoadingPassword(false);
      return;
    }

    try {
      const supabase = createClient();

      // Supabase client-side updateUser updates the password for the current session
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setPasswordError(error.message);
      } else {
        setPasswordMsg("Password changed successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } finally {
      setLoadingPassword(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">
          Manage your profile and account settings
        </p>
      </div>

      {/* Profile Section */}
      <form onSubmit={handleProfileUpdate}>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <User size={18} /> Profile
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full max-w-md rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Email cannot be changed here.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Building2 size={14} className="inline mr-1" />
              Organization
            </label>
            <input
              type="text"
              value={orgName}
              disabled
              className="w-full max-w-md rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
            />
          </div>

          {profileError && (
            <p className="text-sm text-red-600">{profileError}</p>
          )}
          {profileMsg && (
            <p className="text-sm text-green-600">{profileMsg}</p>
          )}

          <button
            type="submit"
            disabled={loadingProfile}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loadingProfile ? "Saving…" : "Save Profile"}
          </button>
        </div>
      </form>

      {/* Organization Section */}
      <form onSubmit={handleOrgUpdate}>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Factory size={18} /> Organization
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Production Mode
            </label>
            <select
              value={productionMode}
              onChange={(e) =>
                setProductionMode(e.target.value as "controlled" | "after_action")
              }
              className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="after_action">After-action — record materials after the run</option>
              <option value="controlled">Controlled — scan as you go, real-time</option>
            </select>
            <p className="mt-2 text-xs text-gray-500">
              <strong>After-action:</strong> operators run the batch first, then enter what they used in a bulk form.{" "}
              <strong>Controlled:</strong> the system gates production — operators scan each lot before consuming it.
              Both modes enforce substitution rules identically; only the input UX differs.
            </p>
          </div>

          {orgError && <p className="text-sm text-red-600">{orgError}</p>}
          {orgMsg && <p className="text-sm text-green-600">{orgMsg}</p>}

          <button
            type="submit"
            disabled={loadingOrg || !orgId}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loadingOrg ? "Saving…" : "Save Organization Settings"}
          </button>
        </div>
      </form>

      {/* Change Password Section */}
      <form onSubmit={handlePasswordChange}>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Lock size={18} /> Change Password
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              placeholder="At least 8 characters"
              className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Re-enter new password"
              className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {passwordError && (
            <p className="text-sm text-red-600">{passwordError}</p>
          )}
          {passwordMsg && (
            <p className="text-sm text-green-600">{passwordMsg}</p>
          )}

          <button
            type="submit"
            disabled={loadingPassword}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loadingPassword ? "Changing…" : "Change Password"}
          </button>
        </div>
      </form>
    </div>
  );
}
