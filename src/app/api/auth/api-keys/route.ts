import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { parseBody } from "@/lib/validation";
import { requireApiAuth, generateApiKey, performedBy } from "@/lib/api-auth";

function createAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET — list this org's API keys (with secrets masked).
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, "api_keys.manage");
  if (!auth.ok) return auth.response;

  const admin = createAdmin();
  const { data: keys } = await admin
    .from("api_keys")
    .select("id, name, key_prefix, scopes, created_at, last_used_at, revoked_at, notes")
    .eq("org_id", auth.org_id)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    keys: (keys ?? []).map((k) => ({
      ...k,
      // Show prefix as "pk_xxxx••••••" so the operator can identify it.
      preview: `${k.key_prefix}••••••`,
    })),
  });
}

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string().min(1)).min(1),
  notes: z.string().optional().nullable(),
});

/**
 * POST — mint a new API key.
 *
 * Returns the plaintext key once. After this response there's no way
 * to recover it — the operator must save it now.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, "api_keys.manage");
  if (!auth.ok) return auth.response;

  const parsed = await parseBody(request, CreateSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const { plaintext, prefix, hash } = generateApiKey();

  const admin = createAdmin();
  const { data: row, error } = await admin
    .from("api_keys")
    .insert({
      org_id: auth.org_id,
      name: body.name,
      key_prefix: prefix,
      key_hash: hash,
      scopes: body.scopes,
      notes: body.notes ?? null,
      created_by: performedBy(auth),
    })
    .select("id, name, key_prefix, scopes, created_at, notes")
    .single();

  if (error || !row) {
    return NextResponse.json(
      { error: "Failed to create API key: " + (error?.message ?? "unknown") },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    key: row,
    plaintext,
    warning:
      "Save this key now — it will not be shown again. Use it as the X-API-Key header.",
  });
}
