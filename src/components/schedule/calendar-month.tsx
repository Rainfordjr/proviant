"use client";

import { getMonthDates } from "@/lib/utils";
import { DayCell } from "./day-cell";
import type { Batch } from "@/types";

interface CalendarMonthProps {
  year: number;
  month: number;
  batches: Batch[];
  onSelectBatch: (batch: Batch) => void;
  onSelectDate: (date: Date) => void;
  selectedDate: Date | null;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarMonth({
  year,
  month,
  batches,
  onSelectBatch,
  onSelectDate,
  selectedDate,
}: CalendarMonthProps) {
  const dates = getMonthDates(year, month);
  const today = new Date();

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {DAYS_OF_WEEK.map((day) => (
          <div
            key={day}
            className="px-2 py-2 text-center text-xs font-semibold uppercase text-gray-500"
          >
            {day}
          </div>
        ))}
      </div>
      {/* Date grid */}
      <div className="grid grid-cols-7">
        {dates.map((date, i) => (
          <DayCell
            key={i}
            date={date}
            currentMonth={month}
            today={today}
            batches={batches}
            onSelectBatch={onSelectBatch}
            onSelectDate={onSelectDate}
            selectedDate={selectedDate}
          />
        ))}
      </div>
    </div>
  );
}
