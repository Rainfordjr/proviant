"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function CompleteBatchButton({
  batchId,
  disabled,
  alreadyComplete,
}: {
  batchId: string;
  disabled: boolean;
  alreadyComplete: boolean;
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function complete() {
    setWorking(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("batches")
      .update({ status: "completed", produced_at: new Date().toISOString() })
      .eq("id", batchId);
    if (error) {
      setError(error.message);
      setWorking(false);
      return;
    }
    router.push("/production/queue");
    router.refresh();
  }

  if (alreadyComplete) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg bg-green-50 text-green-700 py-3 font-semibold">
        <Check size={18} /> Batch complete
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700 mb-2">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={complete}
        disabled={disabled || working}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3.5 text-base font-semibold text-white active:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Check size={20} /> {working ? "Saving…" : "Mark batch complete"}
      </button>
      {disabled && !working && (
        <p className="mt-2 text-center text-xs text-gray-500">
          Consume all ingredients before marking complete.
        </p>
      )}
    </>
  );
}
