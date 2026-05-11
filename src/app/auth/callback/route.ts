import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase auth callback — exchanges the `?code=` from a magic link, OAuth,
 * or password-reset redirect for a real session and sets the cookies that
 * the rest of the app reads. Without this, magic-link sign-in stores the
 * session only in browser memory, so server-rendered pages and RLS-bound
 * queries see no user and return empty data.
 *
 * `next` query param (same-origin paths only) is honored as the post-auth
 * landing page. Defaults to /dashboard.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawNext = url.searchParams.get("next") ?? "";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin)
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
