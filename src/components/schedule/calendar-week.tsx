"use client";

import { cn, getWeekDates, isSameDay, toDateString, formatShortDate } from "@/lib/utils";
import { BatchChip } from "./batch-chip";
import type { Batch } from "@/types";

interface CalendarWeekProps {
  currentDate: Date;
  batches: Batch[];
  onSelectBatch: (batch: Batch) => void;
  onSelectDate: (date: Date) => void;
  selectedDate: Date | null;
}

export function CalendarWeek({
  currentDate,
  batches,
  onSelectBatch,
  onSelectDate,
  selectedDate,
}: CalendarWeekProps) {
  const weekDates = getWeekDates(currentDate);
  const today = new Date();

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="grid grid-cols-7 divide-x divide-gray-200">
        {weekDates.map((date, i) => {
          const isToday = isSameDay(date, today);
          const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
          const dayBatches = batches.filter(
            (b) => b.scheduled_date === toDateString(date)
          );

          return (
            <div
              key={i}
              onClick={() => onSelectDate(date)}
              className={cn(
                "min-h-[400px] cursor-pointer transition-colors",
                isSelected && "bg-blue-50",
                !isSelected && "hover:bg-gray-50"
              )}
            >
              {/* Day header */}
              <div className="border-b border-gray-200 bg-gray-50 px-2 py-2 text-center">
                <div className="text-xs font-medium text-gray-500 uppercase">
                  {date.toLocaleDateString("en-US", { weekday: "short" })}
                </div>
                <div
                  className={cn(
                    "mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                    isToday && "bg-blue-600 text-white",
                    !isToday && "text-gray-900"
                  )}
                >
                  {date.getDate()}
                </div>
              </div>
              {/* Batches */}
              <div className="p-1.5 space-y-1">
                {dayBatches.map((batch) => (
                  <BatchChip
                    key={batch.id}
                    batch={batch}
                    onClick={onSelectBatch}
                  />
                ))}
                {dayBatches.length === 0 && (
                  <div className="text-xs text-gray-300 text-center py-4">
                    No batches
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
