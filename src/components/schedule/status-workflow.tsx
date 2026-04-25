"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { BATCH_STATUSES } from "@/lib/constants";
import { Play, CheckCircle, PauseCircle, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Batch } from "@/types";

interface StatusWorkflowProps {
  batch: Batch;
  onUpdated?: () => void;
}

const TRANSITIONS: Record<string, { label: string; to: string; icon: React.ElementType; color: string }[]> = {
  planned: [
    { label: "Start Production", to: "in_progress", icon: Play, color: "bg-blue-600 hover:bg-blue-700 text-white" },
  ],
  in_progress: [
    { label: "Complete", to: "completed", icon: CheckCircle, color: "bg-green-600 hover:bg-green-700 text-white" },
    { label: "Put on Hold", to: "on_hold", icon: PauseCircle, color: "bg-yellow-500 hover:bg-yellow-600 text-white" },
    { label: "Reject", to: "rejected", icon: XCircle, color: "bg-red-600 hover:bg-red-700 text-white" },
  ],
  on_hold: [
    { label: "Resume", to: "in_progress", icon: Play, color: "bg-blue-600 hover:bg-blue-700 text-white" },
    { label: "Reject", to: "rejected", icon: XCircle, color: "bg-red-600 hover:bg-red-700 text-white" },
  ],
};

export function StatusWorkflow({ batch, onUpdated }: StatusWorkflowProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transitions = TRANSITIONS[batch.status] || [];

  if (transitions.length === 0) return null;

  async function handleTransition(newStatus: string) {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const updateData: Record<string, unknown> = { status: newStatus };

    if (newStatus === "completed") {
      updateData.produced_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("batches")
      .update(updateData)
      .eq("id", batch.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    onUpdated?.();
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {transitions.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.to}
              onClick={() => handleTransition(t.to)}
              disabled={loading}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
                t.color
              )}
            >
              <Icon size={14} />
              {loading ? "Updating…" : t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
