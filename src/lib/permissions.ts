import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

/**
 * Check if the current user has a specific permission.
 * Uses the DB-level user_has_permission() function which checks
 * all assigned roles (including is_admin bypass).
 */
export async function checkPermission(permCode: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("user_has_permission", {
    perm_code: permCode,
  });
  return data === true;
}

/**
 * Check multiple permissions at once. Returns an object keyed by permission code.
 */
export async function checkPermissions(
  permCodes: string[]
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  // Run all checks in parallel
  const checks = await Promise.all(
    permCodes.map(async (code) => ({
      code,
      allowed: await checkPermission(code),
    }))
  );
  for (const { code, allowed } of checks) {
    results[code] = allowed;
  }
  return results;
}

/**
 * Require a permission or redirect to an access-denied page.
 * Use this at the top of server component pages.
 */
export async function requirePermission(permCode: string): Promise<void> {
  const allowed = await checkPermission(permCode);
  if (!allowed) {
    redirect("/dashboard?denied=" + encodeURIComponent(permCode));
  }
}

/**
 * Result of an API-route permission check.
 * - `ok: true`  → caller may proceed; `user` is the authenticated user.
 * - `ok: false` → caller should `return result.response` immediately.
 */
export type PermissionCheck =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse };

/**
 * API-route variant of {@link requirePermission}.
 * Verifies authentication AND that the user holds `permCode`.
 * Does NOT redirect — returns a discriminated result so route handlers
 * can short-circuit with the appropriate JSON response.
 *
 * Usage:
 * ```ts
 * const auth = await requirePermissionApi("billing.manage");
 * if (!auth.ok) return auth.response;
 * const { user } = auth;
 * ```
 */
export async function requirePermissionApi(
  permCode: string
): Promise<PermissionCheck> {
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

  const { data } = await supabase.rpc("user_has_permission", {
    perm_code: permCode,
  });

  if (data !== true) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Missing permission: ${permCode}` },
        { status: 403 }
      ),
    };
  }

  return { ok: true, user };
}
