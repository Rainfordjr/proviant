"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ORDER_STATUSES } from "@/lib/constants";
import { CheckCircle, Hammer, Truck, PackageCheck, XCircle } from "lucide-react";

type OrderStatus = keyof typeof ORDER_STATUSES;

/**
 * Allowed forward transitions per current status. The "cancelled" exit is
 * allowed from any non-terminal state. delivered/cancelled are terminal.
 */
const NEXT_BY_STATUS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

/**
 * Per-target rendering: label, icon, button style. Keeping this separate from
 * the constants so the chip styling on the list/detail header isn't conflated
 * with the action button styling.
 */
const ACTION_META: Record<
  OrderStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  pending: {
    label: "Mark Pending",
    icon: CheckCircle,
    className: "bg-gray-600 text-white hover:bg-gray-700",
  },
  confirmed: {
    label: "Confirm",
    icon: CheckCircle,
    className: "bg-blue-600 text-white hover:bg-blue-700",
  },
  processing: {
    label: "Mark Processing",
    icon: Hammer,
    className: "bg-indigo-600 text-white hover:bg-indigo-700",
  },
  shipped: {
    label: "Mark Shipped",
    icon: Truck,
    className: "bg-purple-600 text-white hover:bg-purple-700",
  },
  delivered: {
    label: "Mark Delivered",
    icon: PackageCheck,
    className: "bg-green-600 text-white hover:bg-green-700",
  },
  cancelled: {
    label: "Cancel Order",
    icon: XCircle,
    className: "border border-red-300 text-red-700 hover:bg-red-50",
  },
};

interface Props {
  orderId: string;
  currentStatus: OrderStatus;
}

export function OrderStatusActions({ orderId, currentStatus }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transitions = NEXT_BY_STATUS[currentStatus] ?? [];

  if (transitions.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        This order is in a terminal state ({ORDER_STATUSES[currentStatus].label.toLowerCase()}).
        No further transitions available.
      </p>
    );
  }

  const advance = async (target: OrderStatus) => {
    if (busy) return;
    setBusy(target);
    setError(null);

    const supabase = createClient();
    // Setting shipped_at when moving to "shipped" preserves the schema's
    // shipped_at column without polluting other transitions.
    const update: { status: OrderStatus; shipped_at?: string } = {
      status: target,
    };
    if (target === "shipped") {
      update.shipped_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update(update)
      .eq("id", orderId);

    if (updateError) {
      setError(updateError.message);
      setBusy(null);
      return;
    }

    setBusy(null);
    router.refresh();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {transitions.map((target) => {
          const meta = ACTION_META[target];
          const Icon = meta.icon;
          const isBusy = busy === target;
          return (
            <button
              key={target}
              type="button"
              onClick={() => advance(target)}
              disabled={busy !== null}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${meta.className}`}
            >
              <Icon size={14} />
              {isBusy ? "Saving…" : meta.label}
            </button>
          );
        })}
      </div>
      {error && (
        <p className="text-xs text-red-600">Failed to update status: {error}</p>
      )}
    </div>
  );
}
