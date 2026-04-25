"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, PanelRightOpen, PanelRightClose } from "lucide-react";
import { CalendarMonth } from "./calendar-month";
import { CalendarWeek } from "./calendar-week";
import { CalendarDay } from "./calendar-day";
import { BatchDetailPanel } from "./batch-detail-panel";
import { BatchPlanningModal } from "./batch-planning-modal";
import { ResourcePanel } from "./resource-panel";
import type { Batch, Product, Recipe, User as UserType, Equipment, ProductComponent } from "@/types";

type ViewMode = "month" | "week" | "day";

interface ScheduleViewProps {
  batches: Batch[];
  products: Product[];
  recipes: Recipe[];
  users: UserType[];
  equipment: Equipment[];
  productComponents: ProductComponent[];
}

export function ScheduleView({
  batches,
  products,
  recipes,
  users,
  equipment,
  productComponents,
}: ScheduleViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showResources, setShowResources] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Navigation
  function navigate(direction: number) {
    const d = new Date(currentDate);
    if (viewMode === "month") {
      d.setMonth(d.getMonth() + direction);
    } else if (viewMode === "week") {
      d.setDate(d.getDate() + direction * 7);
    } else {
      d.setDate(d.getDate() + direction);
    }
    setCurrentDate(d);
  }

  function goToToday() {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  }

  // Title text
  const title = useMemo(() => {
    if (viewMode === "month") {
      return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } else if (viewMode === "week") {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return currentDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [currentDate, viewMode]);

  function handleSelectDate(date: Date) {
    setSelectedDate(date);
    if (viewMode === "month") {
      // If clicking a date in month view, optionally switch to day view
      // For now, just select the date for the resource panel
    }
  }

  function handleSelectBatch(batch: Batch) {
    setSelectedBatch(batch);
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {/* Date navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(-1)}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={goToToday}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Today
            </button>
            <button
              onClick={() => navigate(1)}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Title */}
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {(["month", "week", "day"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                  viewMode === mode
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Resource panel toggle */}
          <button
            onClick={() => setShowResources(!showResources)}
            className={cn(
              "rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors",
              showResources && "bg-gray-100 text-gray-700"
            )}
            title={showResources ? "Hide resources" : "Show resources"}
          >
            {showResources ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </button>

          {/* Schedule batch button */}
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Schedule Batch
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex gap-4">
        {/* Calendar */}
        <div className="flex-1 min-w-0">
          {viewMode === "month" && (
            <CalendarMonth
              year={year}
              month={month}
              batches={batches}
              onSelectBatch={handleSelectBatch}
              onSelectDate={handleSelectDate}
              selectedDate={selectedDate}
            />
          )}
          {viewMode === "week" && (
            <CalendarWeek
              currentDate={currentDate}
              batches={batches}
              onSelectBatch={handleSelectBatch}
              onSelectDate={handleSelectDate}
              selectedDate={selectedDate}
            />
          )}
          {viewMode === "day" && (
            <CalendarDay
              currentDate={currentDate}
              batches={batches}
              onSelectBatch={handleSelectBatch}
            />
          )}
        </div>

        {/* Resource panel */}
        {showResources && (
          <div className="w-72 shrink-0">
            <ResourcePanel
              selectedDate={selectedDate}
              batches={batches}
              equipment={equipment}
              users={users}
            />
          </div>
        )}
      </div>

      {/* Batch detail slide-over */}
      {selectedBatch && (
        <BatchDetailPanel
          batch={selectedBatch}
          equipment={equipment}
          onClose={() => setSelectedBatch(null)}
          onUpdated={() => setSelectedBatch(null)}
        />
      )}

      {/* Batch planning modal */}
      {showModal && (
        <BatchPlanningModal
          products={products}
          recipes={recipes}
          users={users}
          equipment={equipment}
          productComponents={productComponents}
          defaultDate={selectedDate}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
