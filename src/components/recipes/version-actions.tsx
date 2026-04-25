"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Send, CheckCircle, XCircle } from "lucide-react";

interface VersionActionsProps {
  versionId: string;
  recipeId: string;
  status: string;
}

export function VersionActions({ versionId, recipeId, status }: VersionActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState("");

  const handleAction = async (action: "submit" | "approve" | "reject") => {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be logged in.");
      setLoading(false);
      return;
    }

    const now = new Date().toISOString();
    let updateData: any = {};

    if (action === "submit") {
      updateData = {
        status: "submitted",
        submitted_by: user.id,
        submitted_at: now,
      };
    } else if (action === "approve") {
      updateData = {
        status: "approved",
        approved_by: user.id,
        approved_at: now,
      };
    } else if (action === "reject") {
      updateData = {
        status: "rejected",
        rejected_by: user.id,
        rejected_at: now,
        rejection_notes: rejectionNotes || null,
      };
    }

    const { error: updateError } = await supabase
      .from("recipe_versions")
      .update(updateData)
      .eq("id", versionId);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    // If approved, update the recipe's current_version_id
    if (action === "approve") {
      await supabase
        .from("recipes")
        .update({ current_version_id: versionId })
        .eq("id", recipeId);
    }

    setLoading(false);
    router.refresh();
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex items-center gap-3">
        {status === "draft" && (
          <button
            onClick={() => handleAction("submit")}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
          >
            <Send size={16} /> {loading ? "Submitting..." : "Submit for Review"}
          </button>
        )}

        {status === "submitted" && (
          <>
            <button
              onClick={() => handleAction("approve")}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle size={16} /> {loading ? "Approving..." : "Approve"}
            </button>
            <button
              onClick={() => setShowRejectForm(!showRejectForm)}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              <XCircle size={16} /> Reject
            </button>
          </>
        )}
      </div>

      {showRejectForm && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
          <label className="block text-sm font-medium text-red-800">Rejection reason</label>
          <textarea
            rows={3}
            value={rejectionNotes}
            onChange={(e) => setRejectionNotes(e.target.value)}
            placeholder="Explain why this version is being rejected..."
            className="block w-full rounded-lg border border-red-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleAction("reject")}
              disabled={loading}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "Rejecting..." : "Confirm Rejection"}
            </button>
            <button
              onClick={() => setShowRejectForm(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
