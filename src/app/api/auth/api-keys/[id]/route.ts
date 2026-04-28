import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireApiAuth } from "@/lib/api-auth";

function createAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * DELETE — revoke an API key. Soft-delete (revoked_at = now), so we can
 * still attribute past actions to the key.
 */
export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request, "api_keys.manage");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  const admin = createAdmin();
  const { data: row } = await admin
    .from("api_keys")
    .select("id, org_id, revoked_at")
    .eq("id", id)
    .maybeSingle();

  if (!row || row.org_id !== auth.org_id) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }
  if (row.revoked_at) {
    return NextResponse.json({ success: true, alreadyRevoked: true });
  }

  await admin
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ success: true });
}
