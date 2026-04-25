"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Shield } from "lucide-react";

export function AdminHeader() {
  const [userName, setUserName] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("full_name")
          .eq("id", user.id)
          .single();
        if (profile?.full_name) setUserName(profile.full_name);
      }
    }
    load();
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-800 bg-gray-950 px-6">
      <div className="flex items-center gap-2">
        <Shield size={16} className="text-red-400" />
        <span className="text-sm font-medium text-gray-400">Platform Administration</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">{userName}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600/20 text-xs font-bold text-red-400">
          {userName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)}
        </div>
      </div>
    </header>
  );
}
