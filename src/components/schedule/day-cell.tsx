"use client";

import { cn, isSameDay, toDateString } from "@/lib/utils";
import { BatchChip } from "./batch-chip";
import type { Batch } from "@/types";

interface DayCellProps {
  date: Date;
  currentMonth: number;
  today: Date;
  batches: Batch[];
  onSelectBatch: (batch: Batch) => void;
  onSelectDate: (date: Date) => void;
  selectedDate: Date | null;
}

const MAX_VISIBLE = 3;

export function DayCell({
  date,
  currentMonth,
  today,
  batches,
  onSelectBatch,
  onSelectDate,
  selectedDate,
}: DayCellProps) {
  const isCurrentMonth = date.getMonth() === currentMonth;
  const isToday = isSameDay(date, today);
  const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
  const dayBatches = batches.filter(
    (b) => b.scheduled_date === toDateString(date)
  );
  const overflow = dayBatches.length - MAX_VISIBLE;

  return (
    <div
      onClick={() => onSelectDate(date)}
      className={cn(
        "min-h-[100px] border-b border-r border-gray-200 p-1.5 cursor-pointer transition-colors",
        !isCurrentMonth && "bg-gray-50/50",
        isSelected && "bg-blue-50",
        !isSelected && isCurrentMonth && "hover:bg-gray-50"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
            isToday && "bg-blue-600 text-white",
            !isToday && isCurrentMonth && "text-gray-900",
            !isToday && !isCurrentMonth && "text-gray-400"
          )}
        >
          {date.getDate()}
        </span>
        {dayBatches.length > 0 && (
          <span className="text-[10px] font-medium text-gray-400">
            {dayBatches.length}
          </span>
        )}
      </div>
      <div className="space-y-0.5">
        {dayBatches.slice(0, MAX_VISIBLE).map((batch) => (
          <BatchChip
            key={batch.id}
            batch={batch}
            onClick={onSelectBatch}
            compact
          />
        ))}
        {overflow > 0 && (
          <div className="text-[10px] text-gray-500 text-center py-0.5">
            +{overflow} more
          </div>
        )}
      </div>
    </div>
  );
}
