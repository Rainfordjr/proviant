"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ComplianceLogForm() {
  const router = useRouter();
  const [type, setType] = useState("temperature");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("compliance_logs").insert({
      type,
      value,
      notes: notes || null,
      recorded_by: user.id,
      recorded_at: new Date().toISOString(),
    });

    setLoading(false);

    if (!error) {
      setSuccess(true);
      setValue("");
      setNotes("");
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
      <div className="flex-1 min-w-[150px]">
        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="temperature">Temperature Check</option>
          <option value="sanitation">Sanitation</option>
          <option value="allergen">Allergen Control</option>
          <option value="ccp">Critical Control Point</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="flex-1 min-w-[150px]">
        <label className="block text-sm font-medium text-gray-700 mb-1">Value / Reading</label>
        <input
          type="text"
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={type === "temperature" ? "e.g., 38°F" : "Enter value"}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="flex-[2] min-w-[200px]">
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any additional notes"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? "Saving..." : "Record Log"}
      </button>

      {success && (
        <span className="text-sm text-green-600 font-medium">Saved!</span>
      )}
    </form>
  );
}
