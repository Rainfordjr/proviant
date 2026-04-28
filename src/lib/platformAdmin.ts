import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import {
  createClient as createServiceClient,
  type User,
} from "@supabase/supabase-js";

/**
 * Server-side check: require the current user to be a platform super-admin.
 * Redirects to /dashboard if not. Use this in server components / pages.
 */
export async function requirePlatformAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_platform_admin) {
    redirect("/dashboard?denied=platform_admin");
  }

  return user;
}

/**
 * Result of an API-route platform admin check.
 * - `ok: true`  → caller may proceed; `user` is the authenticated platform admin.
 * - `ok: false` → caller should `return result.response` immediately.
 */
export type PlatformAdminCheck =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse };

/**
 * API-route variant of {@link requirePlatformAdmin}.
 * Does NOT redirect — it returns a discriminated result so route handlers
 * can short-circuit with the appropriate JSON response.
 *
 * Usage:
 * ```ts
 * const auth = await verifyPlatformAdminApi();
 * if (!auth.ok) return auth.response;
 * const { user } = auth;
 * ```
 */
export async function verifyPlatformAdminApi(): Promise<PlatformAdminCheck> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      ),
    };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_platform_admin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Not authorized" },
        { status: 403 }
      ),
    };
  }

  return { ok: true, user };
}

/**
 * Returns a Supabase client using the service role key.
 * This bypasses RLS so the admin can read/write across all orgs.
 * Only use this in platform admin routes.
 */
export function createAdminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
