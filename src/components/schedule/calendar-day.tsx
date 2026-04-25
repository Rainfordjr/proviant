"use client";

import { cn, toDateString, isSameDay } from "@/lib/utils";
import { BATCH_STATUSES, SCHEDULE_PRIORITIES } from "@/lib/constants";
import { Clock, User, Package } from "lucide-react";
import type { Batch } from "@/types";

interface CalendarDayProps {
  currentDate: Date;
  batches: Batch[];
  onSelectBatch: (batch: Batch) => void;
}

export function CalendarDay({
  currentDate,
  batches,
  onSelectBatch,
}: CalendarDayProps) {
  const today = new Date();
  const isToday = isSameDay(currentDate, today);
  const dayBatches = batches
    .filter((b) => b.scheduled_date === toDateString(currentDate))
    .sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      return (priorityOrder[a.priority || "normal"] || 2) - (priorityOrder[b.priority || "normal"] || 2);
    });

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Day header */}
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold",
              isToday ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
            )}
          >
            {currentDate.getDate()}
          </div>
          <div>
            <div className="font-semibold text-gray-900">
              {currentDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </div>
            <div className="text-sm text-gray-500">
              {dayBatches.length} batch{dayBatches.length !== 1 ? "es" : ""} scheduled
            </div>
          </div>
        </div>
      </div>

      {/* Batch list */}
      <div className="divide-y divide-gray-100">
        {dayBatches.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Package size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">No batches scheduled for this day</p>
          </div>
        ) : (
          dayBatches.map((batch) => {
            const status = BATCH_STATUSES[batch.status] || BATCH_STATUSES.planned;
            const priority = SCHEDULE_PRIORITIES[batch.priority || "normal"];

            return (
              <button
                key={batch.id}
                onClick={() => onSelectBatch(batch)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">
                        {batch.recipes?.name || batch.product?.name || "Unassigned"}
                      </span>
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium", status.color)}>
                        {status.label}
                      </span>
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium", priority.color)}>
                        {priority.label}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-500">{batch.batch_number}</div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-gray-400">
                      {batch.quantity_produced && (
                        <span className="flex items-center gap-1">
                          <Package size={12} />
                          Qty: {batch.quantity_produced}
                        </span>
                      )}
                      {batch.estimated_duration_hours && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {batch.estimated_duration_hours}h
                        </span>
                      )}
                      {batch.assigned_user && (
                        <span className="flex items-center gap-1">
                          <User size={12} />
                          {batch.assigned_user.full_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
