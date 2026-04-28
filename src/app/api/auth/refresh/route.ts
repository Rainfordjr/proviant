import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { parseBody } from "@/lib/validation";

const RefreshSchema = z.object({
  refresh_token: z.string().min(1),
});

/**
 * Refresh an access token using a refresh token returned from /api/auth/login.
 */
export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, RefreshSchema);
  if (!parsed.ok) return parsed.response;

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: parsed.data.refresh_token,
  });

  if (error || !data.session) {
    return NextResponse.json(
      { error: error?.message ?? "Invalid refresh token" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    expires_in: data.session.expires_in,
  });
}
