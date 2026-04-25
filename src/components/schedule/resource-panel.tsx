"use client";

import { useMemo } from "react";
import { cn, toDateString } from "@/lib/utils";
import { Wrench, User, AlertTriangle, CheckCircle } from "lucide-react";
import type { Batch, Equipment, User as UserType } from "@/types";

interface ResourcePanelProps {
  selectedDate: Date | null;
  batches: Batch[];
  equipment: Equipment[];
  users: UserType[];
}

export function ResourcePanel({
  selectedDate,
  batches,
  equipment,
  users,
}: ResourcePanelProps) {
  const dateStr = selectedDate ? toDateString(selectedDate) : null;

  // Batches for selected date
  const dayBatches = useMemo(
    () => (dateStr ? batches.filter((b) => b.scheduled_date === dateStr) : []),
    [batches, dateStr]
  );

  // Equipment usage for selected date
  const equipmentUsage = useMemo(() => {
    const usedIds = new Set<string>();
    for (const batch of dayBatches) {
      for (const ra of batch.resource_assignments || []) {
        if (ra.resource_type === "equipment") {
          usedIds.add(ra.resource_id);
        }
      }
    }
    return usedIds;
  }, [dayBatches]);

  // Labor assignments for selected date
  const assignedUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const batch of dayBatches) {
      if (batch.assigned_to) ids.add(batch.assigned_to);
    }
    return ids;
  }, [dayBatches]);

  if (!selectedDate) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-400 text-center py-6">
          Select a date to view resource availability
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
          {selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-blue-50 p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">{dayBatches.length}</div>
            <div className="text-xs text-blue-600">Batches</div>
          </div>
          <div className="rounded-lg bg-purple-50 p-3 text-center">
            <div className="text-2xl font-bold text-purple-700">{assignedUserIds.size}</div>
            <div className="text-xs text-purple-600">Operators</div>
          </div>
        </div>
      </div>

      {/* Equipment */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
          <Wrench size={14} />
          Equipment
        </h3>
        {equipment.length === 0 ? (
          <p className="text-sm text-gray-400">No equipment configured</p>
        ) : (
          <div className="space-y-1.5">
            {equipment.map((eq) => {
              const inUse = equipmentUsage.has(eq.id);
              return (
                <div
                  key={eq.id}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm"
                >
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full",
                      inUse ? "bg-orange-400" : "bg-green-400"
                    )}
                  />
                  <span className="flex-1 text-gray-700 truncate">{eq.name}</span>
                  <span className={cn("text-xs", inUse ? "text-orange-600" : "text-green-600")}>
                    {inUse ? "In use" : "Available"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Labor */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
          <User size={14} />
          Labor
        </h3>
        {users.length === 0 ? (
          <p className="text-sm text-gray-400">No users found</p>
        ) : (
          <div className="space-y-1.5">
            {users.map((u) => {
              const assigned = assignedUserIds.has(u.id);
              const userBatches = dayBatches.filter((b) => b.assigned_to === u.id);
              return (
                <div
                  key={u.id}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm"
                >
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full",
                      assigned ? "bg-blue-400" : "bg-gray-300"
                    )}
                  />
                  <span className="flex-1 text-gray-700 truncate">{u.full_name}</span>
                  {assigned && (
                    <span className="text-xs text-blue-600">
                      {userBatches.length} batch{userBatches.length !== 1 ? "es" : ""}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Material warnings */}
      {dayBatches.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
            <AlertTriangle size={14} />
            Material Check
          </h3>
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle size={14} />
            <span>Material sufficiency checks require recipe ingredients data</span>
          </div>
        </div>
      )}
    </div>
  );
}
