"use client";

import { cn } from "@/lib/utils";
import { BATCH_STATUSES, SCHEDULE_PRIORITIES } from "@/lib/constants";
import type { Batch } from "@/types";

interface BatchChipProps {
  batch: Batch;
  onClick: (batch: Batch) => void;
  compact?: boolean;
}

export function BatchChip({ batch, onClick, compact = false }: BatchChipProps) {
  const status = BATCH_STATUSES[batch.status] || BATCH_STATUSES.planned;
  const priority = SCHEDULE_PRIORITIES[batch.priority || "normal"];

  return (
    <button
      onClick={() => onClick(batch)}
      className={cn(
        "w-full text-left rounded-md border-l-3 px-2 py-1 text-xs transition-colors hover:shadow-sm",
        priority.border,
        status.color
      )}
      title={`${batch.batch_number} — ${batch.recipes?.name || batch.product?.name || "Unassigned"}`}
    >
      <div className="font-medium truncate">
        {compact
          ? batch.batch_number
          : (batch.recipes?.name || batch.product?.name || batch.batch_number)}
      </div>
      {!compact && (
        <div className="text-[10px] opacity-70 truncate">
          {batch.batch_number}
          {batch.quantity_produced ? ` · ${batch.quantity_produced}` : ""}
        </div>
      )}
    </button>
  );
}
