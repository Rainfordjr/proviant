"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function DevProjectStatusActions({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const updateStatus = async (status: "completed" | "cancelled") => {
    setLoading(true);
    const supabase = createClient();
    await supabase.from("dev_projects").update({ status }).eq("id", projectId);
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="flex items-center gap-3">
      <button onClick={() => updateStatus("completed")} disabled={loading}
        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
        <CheckCircle size={16} /> Mark Complete
      </button>
      <button onClick={() => updateStatus("cancelled")} disabled={loading}
        className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
        <XCircle size={16} /> Cancel Project
      </button>
    </div>
  );
}
