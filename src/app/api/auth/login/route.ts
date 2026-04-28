import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { parseBody } from "@/lib/validation";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Headless login endpoint.
 *
 * Trades email + password for a Supabase session. Returns the access JWT
 * (use it as `Authorization: Bearer <access_token>` on subsequent
 * /api/* calls) and the refresh token for renewing it.
 *
 * For browser callers, the existing cookie-based auth still works without
 * needing this route; it's specifically for scripts, integrations, and
 * automated testing.
 */
export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, LoginSchema);
  if (!parsed.ok) return parsed.response;
  const { email, password } = parsed.data;

  // Use the anon-key client for password auth (the service role can't
  // sign in as a user; this is the public auth endpoint).
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return NextResponse.json(
      { error: error?.message ?? "Invalid email or password" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  });
}
