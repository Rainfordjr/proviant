"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftRight, Factory } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const LINE_KEY = "proviant_line_id";

export function ProductionShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [lineName, setLineName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = localStorage.getItem(LINE_KEY);
    if (!id) return;
    const supabase = createClient();
    supabase.from("production_lines").select("name").eq("id", id).maybeSingle().then(({ data }) => {
      if (data?.name) setLineName(data.name as string);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/production-sw.js", { scope: "/production" })
      .catch(() => { /* swallow — non-critical */ });
  }, []);

  function switchLine() {
    if (typeof window !== "undefined") {
      localStorage.removeItem(LINE_KEY);
    }
    setLineName(null);
    router.push("/production");
  }

  return (
    <div className="flex flex-col h-dvh bg-gray-50">
      <header
        className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <Link href="/production" className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Factory size={18} />
          </div>
          <span className="font-semibold text-gray-900 truncate">Proviant Production</span>
        </Link>
        <div className="flex items-center gap-2">
          {lineName ? (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
              Line: {lineName}
            </span>
          ) : (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-500">
              No line picked
            </span>
          )}
          <button
            onClick={switchLine}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Switch line"
            title="Switch line"
          >
            <ArrowLeftRight size={18} />
          </button>
        </div>
      </header>
      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {children}
      </main>
    </div>
  );
}
