"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AlertTriangle, Save, ChevronDown } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface PermissionItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  granted: boolean;
}

interface Props {
  roleId: string;
  categories: Record<string, PermissionItem[]>;
  mode: "whitelist" | "blacklist";
  isLastAdminRole?: boolean;
}

export function PermissionToggles({ roleId, categories, mode, isLastAdminRole }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  // All collapsed by default
  const allCategories = useMemo(() => new Set(Object.keys(categories)), [categories]);
  const [collapsed, setCollapsed] = useState<Set<string>>(allCategories);

  const toggleCollapse = (category: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  // Local state for mode and permission toggles (unsaved until "Save" is clicked)
  const [currentMode, setCurrentMode] = useState(mode);
  const [modeChanged, setModeChanged] = useState(false);

  // Track local toggle state: map of permissionId -> checked
  const initialState = useMemo(() => {
    const state: Record<string, boolean> = {};
    for (const perms of Object.values(categories)) {
      for (const p of perms) {
        state[p.id] = p.granted;
      }
    }
    return state;
  }, [categories]);

  const [localState, setLocalState] = useState<Record<string, boolean>>(initialState);

  // Detect unsaved changes
  const hasChanges = useMemo(() => {
    if (modeChanged) return true;
    for (const [id, checked] of Object.entries(localState)) {
      if (checked !== initialState[id]) return true;
    }
    return false;
  }, [localState, initialState, modeChanged]);

  const switchMode = (newMode: "whitelist" | "blacklist") => {
    setCurrentMode(newMode);
    setModeChanged(newMode !== mode);
    // Clear all local toggles when switching mode
    const cleared: Record<string, boolean> = {};
    for (const id of Object.keys(localState)) {
      cleared[id] = false;
    }
    setLocalState(cleared);
  };

  const togglePermission = (permissionId: string) => {
    setLocalState((prev) => ({ ...prev, [permissionId]: !prev[permissionId] }));

  };

  const toggleCategory = (perms: PermissionItem[]) => {
    const allChecked = perms.every((p) => localState[p.id]);
    setLocalState((prev) => {
      const next = { ...prev };
      for (const p of perms) {
        next[p.id] = !allChecked;
      }
      return next;
    });

  };

  const handleSave = async () => {
    // If this is the last admin role, ensure at least some permissions remain
    if (isLastAdminRole) {
      const grantedCount = Object.values(localState).filter(Boolean).length;
      if (currentMode === "whitelist" && grantedCount === 0) {
        toast.warning("Cannot remove all permissions from the last administrator role.", 5000);
        return;
      }
    }

    setSaving(true);
    const supabase = createClient();

    // Update mode if changed
    if (modeChanged) {
      await supabase.from("roles").update({ mode: currentMode }).eq("id", roleId);
    }

    // Figure out what needs to be added and removed
    const toAdd: string[] = [];
    const toRemove: string[] = [];

    for (const [permId, checked] of Object.entries(localState)) {
      const wasChecked = initialState[permId];
      if (modeChanged) {
        // Mode changed — we cleared everything, so remove all old and add new checked ones
        if (wasChecked) toRemove.push(permId);
        if (checked) toAdd.push(permId);
      } else {
        if (checked && !wasChecked) toAdd.push(permId);
        if (!checked && wasChecked) toRemove.push(permId);
      }
    }

    // Remove permissions
    if (toRemove.length > 0) {
      for (const permId of toRemove) {
        await supabase
          .from("role_permissions")
          .delete()
          .eq("role_id", roleId)
          .eq("permission_id", permId);
      }
    }

    // Add permissions
    if (toAdd.length > 0) {
      await supabase.from("role_permissions").insert(
        toAdd.map((permId) => ({ role_id: roleId, permission_id: permId }))
      );
    }

    setSaving(false);
    setModeChanged(false);
    toast.success("Permissions saved successfully.");
    router.refresh();
  };

  const handleDiscard = () => {
    setLocalState(initialState);
    setCurrentMode(mode);
    setModeChanged(false);

  };

  const isWhitelist = currentMode === "whitelist";

  return (
    <div className="space-y-6">
      {/* Unsaved changes warning */}
      {hasChanges && (
        <div className="sticky top-16 z-20 flex items-center justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-600 shrink-0" />
            <p className="text-sm font-medium text-amber-800">
              You have unsaved changes. Save to apply them.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscard}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">Permission Mode</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {isWhitelist
              ? "Whitelist — this role can only do what's checked below"
              : "Blacklist — this role can do everything except what's checked below"}
          </p>
        </div>
        <div className="flex rounded-lg border border-gray-300 bg-white overflow-hidden">
          <button
            onClick={() => !isWhitelist && switchMode("whitelist")}
            disabled={saving}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              isWhitelist
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            Whitelist
          </button>
          <button
            onClick={() => isWhitelist && switchMode("blacklist")}
            disabled={saving}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              !isWhitelist
                ? "bg-orange-600 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            Blacklist
          </button>
        </div>
      </div>

      {/* Info banner */}
      {!isWhitelist && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
          <p className="text-sm text-orange-800">
            <strong>Blacklist mode:</strong> Check the permissions you want to <strong>deny</strong>. Everything unchecked is allowed.
          </p>
        </div>
      )}

      {/* Permission categories */}
      <div className="space-y-2">
      {Object.entries(categories).map(([category, perms]) => {
        const allChecked = perms.every((p) => localState[p.id]);
        const checkedCount = perms.filter((p) => localState[p.id]).length;
        const changedCount = perms.filter((p) => localState[p.id] !== initialState[p.id]).length;
        const isCollapsed = collapsed.has(category);

        return (
          <div key={category} className="rounded-lg border border-gray-200 overflow-hidden">
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleCollapse(category)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCollapse(category); } }}
              className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <ChevronDown
                  size={16}
                  className={`text-gray-400 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                />
                <h3 className="text-sm font-semibold text-gray-900">{category}</h3>
                <span className="text-xs text-gray-500">
                  {checkedCount}/{perms.length} {isWhitelist ? "granted" : "blocked"}
                </span>
                {changedCount > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    {changedCount} changed
                  </span>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); toggleCategory(perms); }}
                disabled={saving}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {allChecked
                  ? (isWhitelist ? "Remove All" : "Unblock All")
                  : (isWhitelist ? "Grant All" : "Block All")}
              </button>
            </div>
            {!isCollapsed && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 p-4">
                {perms.map((perm) => {
                  const checked = localState[perm.id] ?? false;
                  const wasChanged = checked !== initialState[perm.id];
                  const colorClass = isWhitelist
                    ? checked
                      ? "border-blue-200 bg-blue-50/50"
                      : "border-gray-200 hover:border-gray-300"
                    : checked
                      ? "border-orange-200 bg-orange-50/50"
                      : "border-gray-200 hover:border-gray-300";

                  return (
                    <label
                      key={perm.id}
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${colorClass} ${
                        wasChanged ? "ring-2 ring-amber-300" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePermission(perm.id)}
                        disabled={saving}
                        className={`h-4 w-4 rounded border-gray-300 focus:ring-blue-500 ${
                          isWhitelist ? "text-blue-600" : "text-orange-600"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{perm.name}</p>
                        {perm.description && (
                          <p className="text-xs text-gray-500 truncate">{perm.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {wasChanged && (
                          <span className="text-xs font-medium text-amber-600">Changed</span>
                        )}
                        {checked && !wasChanged && (
                          <span className={`text-xs font-medium ${
                            isWhitelist ? "text-blue-600" : "text-orange-600"
                          }`}>
                            {isWhitelist ? "Allowed" : "Denied"}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
