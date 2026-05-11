"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Client-side auth watcher. Renders nothing on its own; mount it once
 * near the top of a section's layout. Two jobs:
 *
 *   1. On mount, ask Supabase for the current user. If there isn't one
 *      (cookie expired, session revoked server-side, etc.), bounce to
 *      /login with the current path stashed as `?next=` so we can
 *      return after re-auth.
 *
 *   2. Subscribe to onAuthStateChange. If we ever observe SIGNED_OUT
 *      (or a TOKEN_REFRESHED event with no session — refresh failed),
 *      redirect immediately.
 *
 * The server-side middleware already redirects on navigation; this fills
 * the gap when a session goes bad while the user is sitting on a page.
 */
export function AuthGuard({ loginPath = "/login" }: { loginPath?: string } = {}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    function bounce() {
      if (!active) return;
      const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`${loginPath}${next}`);
    }

    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) bounce();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") bounce();
      else if (event === "TOKEN_REFRESHED" && !session) bounce();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router, pathname, loginPath]);

  return null;
}
