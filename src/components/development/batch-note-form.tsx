"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function DevBatchNoteForm({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noteType, setNoteType] = useState<string>("observation");
  const [content, setContent] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("dev_batch_notes").insert({
      batch_id: batchId,
      note_type: noteType,
      content: content.trim(),
      recorded_by: user?.id || null,
    });

    setContent("");
    setOpen(false);
    setLoading(false);
    router.refresh();
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-purple-600">
        <Plus size={12} /> Add note
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end mt-2">
      <select value={noteType} onChange={(e) => setNoteType(e.target.value)}
        className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500">
        <option value="observation">Observation</option>
        <option value="test_result">Test Result</option>
        <option value="adjustment">Adjustment</option>
        <option value="conclusion">Conclusion</option>
      </select>
      <input type="text" value={content} onChange={(e) => setContent(e.target.value)}
        placeholder="Log your observation or result..."
        className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500" />
      <button type="submit" disabled={loading || !content.trim()}
        className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50">
        {loading ? "..." : "Log"}
      </button>
      <button type="button" onClick={() => setOpen(false)}
        className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
        Cancel
      </button>
    </form>
  );
}
