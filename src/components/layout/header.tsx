"use client";

import { Bell, Search, User, LogOut, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function Header() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [userInitials, setUserInitials] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        // Fetch from users table for the display name
        const { data: profile } = await supabase
          .from("users")
          .select("full_name, email, is_platform_admin")
          .eq("id", authUser.id)
          .single();

        const name = profile?.full_name || authUser.email || "User";
        setUserName(name);
        setIsPlatformAdmin(!!profile?.is_platform_admin);

        // Build initials from name
        const parts = name.split(" ").filter(Boolean);
        const initials =
          parts.length >= 2
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : name.slice(0, 2).toUpperCase();
        setUserInitials(initials);
      }
    }
    loadUser();
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      {/* Search */}
      <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 w-96">
        <Search size={16} className="text-gray-400" />
        <input
          type="text"
          placeholder="Search batches, products, orders..."
          className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100">
          <Bell size={20} />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-semibold">
              {userInitials || <User size={16} />}
            </div>
            <span className="font-medium">{userName || "…"}</span>
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">
                  Signed in as<br />
                  <span className="font-medium text-gray-700">{userName}</span>
                </div>
                {isPlatformAdmin && (
                  <Link
                    href="/admin"
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    onClick={() => setShowMenu(false)}
                  >
                    <Shield size={14} /> Admin Panel
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
