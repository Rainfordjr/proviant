"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChefHat, ShoppingBag, Clock, Calendar, Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BATCH_STATUSES } from "@/lib/constants";

const LINE_KEY = "proviant_line_id";

type QueueBatch = {
  id: string;
  batch_number: string;
  status: keyof typeof BATCH_STATUSES;
  scheduled_for: string | null;
  recipes: { name: string } | null;
  products: { name: string; sku: string } | null;
};

function formatScheduled(iso: string | null): { label: string; relative: boolean } {
  if (!iso) return { label: "Not scheduled", relative: false };
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return {
      label: `Today, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
      relative: true,
    };
  }
  return {
    label: d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    relative: false,
  };
}

export default function ProductionQueuePage() {
  const router = useRouter();
  const [batches, setBatches] = useState<QueueBatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const lineId = typeof window !== "undefined" ? localStorage.getItem(LINE_KEY) : null;
    if (!lineId) {
      router.replace("/production");
      return;
    }
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase
        .from("batches")
        .select("id, batch_number, status, scheduled_for, recipes(name), products(name, sku)")
        .eq("production_line_id", lineId)
        .in("status", ["planned", "in_progress", "on_hold"])
        .order("scheduled_for", { ascending: true, nullsFirst: false });
      if (error) {
        setError(error.message);
        return;
      }
      setBatches((data || []) as unknown as QueueBatch[]);
    })();
  }, [router]);

  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  if (batches === null) {
    return <div className="p-8 text-center text-sm text-gray-500">Loading queue…</div>;
  }

  if (batches.length === 0) {
    return (
      <div className="p-8 text-center">
        <Inbox size={48} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">No batches scheduled to this line.</p>
        <p className="text-xs text-gray-400 mt-1">A manager can schedule batches from the main app.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100 bg-white">
      {batches.map((batch) => {
        const sched = formatScheduled(batch.scheduled_for);
        const status = BATCH_STATUSES[batch.status] || BATCH_STATUSES.planned;
        return (
          <li key={batch.id}>
            <Link
              href={`/production/batches/${batch.id}`}
              className="block px-4 py-4 active:bg-blue-50 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <h3 className="text-base font-semibold text-gray-900 truncate">{batch.batch_number}</h3>
                <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                  {status.label}
                </span>
              </div>
              {batch.products?.name && (
                <p className="text-sm text-gray-700 flex items-center gap-1.5">
                  <ShoppingBag size={14} className="text-gray-400" />
                  {batch.products.name} <span className="text-gray-400">({batch.products.sku})</span>
                </p>
              )}
              {batch.recipes?.name && (
                <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                  <ChefHat size={14} className="text-gray-400" />
                  {batch.recipes.name}
                </p>
              )}
              <p className={`text-sm flex items-center gap-1.5 mt-1 ${sched.relative ? "text-blue-700 font-medium" : "text-gray-500"}`}>
                {sched.relative ? <Clock size={14} /> : <Calendar size={14} className="text-gray-400" />}
                {sched.label}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
