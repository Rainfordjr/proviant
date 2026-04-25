"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Users, ChevronDown, ChevronRight, Trash2, Star, UserPlus, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Member {
  id: string;
  is_lead: boolean;
  user: { id: string; full_name: string; email: string } | null;
}

interface Department {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  user_departments: Member[];
}

interface Props {
  departments: Department[];
  users: { id: string; full_name: string; email: string }[];
  taskCounts: Record<string, number>;
  orgId: string;
  canManage: boolean;
}

const COLORS = [
  "#6B7280", "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#6366F1",
];

export function DepartmentsManager({ departments, users, taskCounts, orgId, canManage }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState("#3B82F6");
  const [saving, setSaving] = useState(false);
  const [addingMember, setAddingMember] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState("");

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function createDepartment(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("departments").insert({
      org_id: orgId,
      name: newName.trim(),
      description: newDesc.trim() || null,
      color: newColor,
    });
    setNewName("");
    setNewDesc("");
    setShowNew(false);
    setSaving(false);
    router.refresh();
  }

  async function toggleActive(dept: Department) {
    const supabase = createClient();
    await supabase.from("departments").update({ is_active: !dept.is_active }).eq("id", dept.id);
    router.refresh();
  }

  async function deleteDepartment(id: string) {
    if (!confirm("Delete this department? Members will be removed but tasks will remain.")) return;
    const supabase = createClient();
    await supabase.from("departments").delete().eq("id", id);
    router.refresh();
  }

  async function addMember(deptId: string) {
    if (!selectedUser) return;
    const supabase = createClient();
    await supabase.from("user_departments").insert({
      user_id: selectedUser,
      department_id: deptId,
    });
    setSelectedUser("");
    setAddingMember(null);
    router.refresh();
  }

  async function removeMember(membershipId: string) {
    const supabase = createClient();
    await supabase.from("user_departments").delete().eq("id", membershipId);
    router.refresh();
  }

  async function toggleLead(membershipId: string, currentLead: boolean) {
    const supabase = createClient();
    await supabase.from("user_departments").update({ is_lead: !currentLead }).eq("id", membershipId);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* New department button */}
      {canManage && !showNew && (
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> New Department
        </button>
      )}

      {/* New department form */}
      {showNew && (
        <form onSubmit={createDepartment} className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Create Department</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Production, QA, Shipping"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <div className="flex items-center gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${
                      newColor === c ? "border-gray-900 scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Optional description"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !newName.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Department list */}
      {departments.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">No departments yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {departments.map((dept) => {
            const isExpanded = expanded.has(dept.id);
            const members = dept.user_departments || [];
            const activeTasks = taskCounts[dept.id] || 0;
            const existingUserIds = new Set(members.map((m) => m.user?.id));
            const availableUsers = users.filter((u) => !existingUserIds.has(u.id));

            return (
              <div
                key={dept.id}
                className={`rounded-xl border bg-white shadow-sm transition-colors ${
                  dept.is_active ? "border-gray-200" : "border-gray-100 opacity-60"
                }`}
              >
                {/* Header */}
                <div
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none"
                  onClick={() => toggle(dept.id)}
                >
                  {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                  <div
                    className="h-4 w-4 rounded-full shrink-0"
                    style={{ backgroundColor: dept.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-gray-900">{dept.name}</span>
                    {dept.description && (
                      <span className="ml-2 text-xs text-gray-400">{dept.description}</span>
                    )}
                    {!dept.is_active && (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">Inactive</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {members.length}
                    </span>
                    <span>{activeTasks} active task{activeTasks !== 1 ? "s" : ""}</span>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4 space-y-3">
                    {/* Members */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Members</h4>
                      {members.length === 0 ? (
                        <p className="text-sm text-gray-400">No members assigned</p>
                      ) : (
                        <div className="space-y-1">
                          {members.map((m) => (
                            <div key={m.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50">
                              <div className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                                {(m.user?.full_name || m.user?.email || "?")[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-gray-700">{m.user?.full_name || m.user?.email}</span>
                                {m.is_lead && (
                                  <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                    <Star size={10} /> Lead
                                  </span>
                                )}
                              </div>
                              {canManage && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleLead(m.id, m.is_lead); }}
                                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-amber-500"
                                    title={m.is_lead ? "Remove lead" : "Make lead"}
                                  >
                                    <Star size={14} fill={m.is_lead ? "currentColor" : "none"} />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); removeMember(m.id); }}
                                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                                    title="Remove from department"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add member */}
                      {canManage && (
                        addingMember === dept.id ? (
                          <div className="flex items-center gap-2 mt-2">
                            <select
                              value={selectedUser}
                              onChange={(e) => setSelectedUser(e.target.value)}
                              className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-300 focus:outline-none"
                            >
                              <option value="">Select user…</option>
                              {availableUsers.map((u) => (
                                <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => addMember(dept.id)}
                              disabled={!selectedUser}
                              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => { setAddingMember(null); setSelectedUser(""); }}
                              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAddingMember(dept.id)}
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mt-1"
                          >
                            <UserPlus size={14} /> Add Member
                          </button>
                        )
                      )}
                    </div>

                    {/* Actions */}
                    {canManage && (
                      <div className="flex items-center gap-3 border-t border-gray-100 pt-3">
                        <button
                          onClick={() => toggleActive(dept)}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          {dept.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => deleteDepartment(dept.id)}
                          className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
