"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Factory } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const LINE_KEY = "proviant_line_id";

type Line = { id: string; name: string; description: string | null };

export default function ProductionEntryPage() {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("production_lines")
        .select("id, name, description")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      const all = (data || []) as Line[];
      setLines(all);

      // If a line is already stored AND still exists, redirect to queue.
      const stored = localStorage.getItem(LINE_KEY);
      if (stored && all.some((l) => l.id === stored)) {
        router.replace("/production/queue");
        return;
      }
      if (stored) {
        // Stored line was deleted — clear it.
        localStorage.removeItem(LINE_KEY);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [router]);

  function pickLine(id: string) {
    localStorage.setItem(LINE_KEY, id);
    router.push("/production/queue");
  }

  if (loading) {
    return <div className="p-8 text-center text-sm text-gray-500">Loading lines…</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Pick your production line</h1>
        <p className="text-sm text-gray-500 mt-1">
          The app will show only batches scheduled to this line. You can switch later.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {lines.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No production lines configured. Ask a manager to set one up in Settings → Production Lines.
        </div>
      ) : (
        <ul className="space-y-3">
          {lines.map((line) => (
            <li key={line.id}>
              <button
                onClick={() => pickLine(line.id)}
                className="w-full rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm active:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600 flex-shrink-0">
                    <Factory size={24} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-gray-900">{line.name}</h2>
                    {line.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{line.description}</p>
                    )}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
