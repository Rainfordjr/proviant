"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";

interface Props {
  userId: string;
  currentRoles: any[];
  allRoles: any[];
}

export function UserRoleManager({ userId, currentRoles, allRoles }: Props) {
  const router = useRouter();
  const { warning } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState("");

  const currentRoleIds = new Set(currentRoles.map((r) => r.role_id));
  const availableRoles = allRoles.filter((r) => !currentRoleIds.has(r.id));

  const assignRole = async () => {
    if (!selectedRoleId) return;
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("user_roles").insert({
      user_id: userId,
      role_id: selectedRoleId,
      assigned_by: user?.id || null,
    });

    setSelectedRoleId("");
    setShowAdd(false);
    setLoading(false);
    router.refresh();
  };

  const removeRole = async (userRoleId: string, role: any) => {
    // If this is an admin role, check if there would still be at least one admin left
    if (role?.is_admin) {
      setLoading(true);
      const supabase = createClient();

      const { count } = await supabase
        .from("user_roles")
        .select("id, roles!inner(is_admin)", { count: "exact", head: true })
        .eq("roles.is_admin", true);

      if ((count || 0) <= 1) {
        warning("Cannot remove the last administrator. At least one user must have an admin role.", 5000);
        setLoading(false);
        return;
      }

      await supabase.from("user_roles").delete().eq("id", userRoleId);
      setLoading(false);
      router.refresh();
    } else {
      setLoading(true);
      const supabase = createClient();
      await supabase.from("user_roles").delete().eq("id", userRoleId);
      setLoading(false);
      router.refresh();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {currentRoles.map((ur) => (
        <span key={ur.id} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
          ur.roles?.is_admin ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
        }`}>
          {ur.roles?.name}
          <button onClick={() => removeRole(ur.id, ur.roles)} disabled={loading}
            className="ml-0.5 hover:text-red-600">
            <X size={12} />
          </button>
        </span>
      ))}

      {showAdd ? (
        <div className="flex items-center gap-1">
          <select value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none">
            <option value="">Select role...</option>
            {availableRoles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button onClick={assignRole} disabled={loading || !selectedRoleId}
            className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50">
            Add
          </button>
          <button onClick={() => setShowAdd(false)}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600">
          <Plus size={10} /> Role
        </button>
      )}
    </div>
  );
}
