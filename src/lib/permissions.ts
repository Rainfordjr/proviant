import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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
