import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * Server-side check: require the current user to be a platform super-admin.
 * Redirects to /dashboard if not.
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
