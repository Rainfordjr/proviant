import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requirePermissionApi } from "@/lib/permissions";
import { parseBody } from "@/lib/validation";

function createAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Mask a secret for the UI: keep the last 4 characters, replace the rest
 * with bullets. Returns "" for empty/null so the field is rendered blank.
 */
function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 4) return "•".repeat(value.length);
  return "••••••" + value.slice(-4);
}

async function resolveOrgId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();
  return profile?.org_id
    ? { user_id: user.id, org_id: profile.org_id as string }
    : null;
}

/**
 * GET — return the current org's gateway settings, with secrets masked.
 * Public client keys (e.g. auth_net_public_client_key) are returned as-is
 * because the browser needs them to render Accept.js.
 */
export async function GET() {
  const auth = await requirePermissionApi("customer_billing.manage");
  if (!auth.ok) return auth.response;

  const ctx = await resolveOrgId();
  if (!ctx) {
    return NextResponse.json({ error: "No org found" }, { status: 400 });
  }

  const admin = createAdmin();
  const { data: row } = await admin
    .from("org_payment_gateways")
    .select("*")
    .eq("org_id", ctx.org_id)
    .maybeSingle();

  return NextResponse.json({
    settings: {
      auth_net_environment: row?.auth_net_environment ?? "sandbox",
      auth_net_api_login_id: maskSecret(row?.auth_net_api_login_id),
      auth_net_transaction_key: maskSecret(row?.auth_net_transaction_key),
      auth_net_public_client_key: row?.auth_net_public_client_key ?? "",
      auth_net_configured: !!(
        row?.auth_net_api_login_id && row?.auth_net_transaction_key
      ),

      bill_dot_com_environment: row?.bill_dot_com_environment ?? "sandbox",
      bill_dot_com_username: row?.bill_dot_com_username ?? "",
      bill_dot_com_password: maskSecret(row?.bill_dot_com_password),
      bill_dot_com_dev_key: maskSecret(row?.bill_dot_com_dev_key),
      bill_dot_com_org_id: row?.bill_dot_com_org_id ?? "",
      bill_dot_com_configured: !!(
        row?.bill_dot_com_dev_key &&
        row?.bill_dot_com_username &&
        row?.bill_dot_com_password
      ),
    },
  });
}

const PutSchema = z.object({
  auth_net_environment: z.enum(["sandbox", "production"]).optional(),
  auth_net_api_login_id: z.string().optional(),
  auth_net_transaction_key: z.string().optional(),
  auth_net_public_client_key: z.string().optional(),

  bill_dot_com_environment: z.enum(["sandbox", "production"]).optional(),
  bill_dot_com_dev_key: z.string().optional(),
  bill_dot_com_username: z.string().optional(),
  bill_dot_com_password: z.string().optional(),
  bill_dot_com_org_id: z.string().optional(),
});

/**
 * PUT — update the org's gateway settings.
 *
 * Convention: a field that is `undefined` (omitted) is left unchanged.
 * A field that is the empty string clears the stored value.
 * Secret fields whose submitted value still looks like the masked
 * placeholder ("••••••XXXX") are also treated as "leave unchanged" so
 * the form doesn't accidentally overwrite a real secret with bullets.
 */
export async function PUT(request: NextRequest) {
  const auth = await requirePermissionApi("customer_billing.manage");
  if (!auth.ok) return auth.response;

  const ctx = await resolveOrgId();
  if (!ctx) {
    return NextResponse.json({ error: "No org found" }, { status: 400 });
  }

  const parsed = await parseBody(request, PutSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const admin = createAdmin();
  const { data: existing } = await admin
    .from("org_payment_gateways")
    .select("*")
    .eq("org_id", ctx.org_id)
    .maybeSingle();

  const isMaskedPlaceholder = (v: string | undefined | null) =>
    typeof v === "string" && v.startsWith("••••••");

  // Resolve each field: undefined → keep existing, masked → keep, else use new.
  const resolveSecret = (
    next: string | undefined,
    current: string | null | undefined
  ): string | null => {
    if (next === undefined) return current ?? null;
    if (isMaskedPlaceholder(next)) return current ?? null;
    if (next === "") return null;
    return next;
  };
  const resolvePlain = (
    next: string | undefined,
    current: string | null | undefined
  ): string | null => {
    if (next === undefined) return current ?? null;
    if (next === "") return null;
    return next;
  };

  const payload = {
    org_id: ctx.org_id,

    auth_net_environment:
      body.auth_net_environment ?? existing?.auth_net_environment ?? "sandbox",
    auth_net_api_login_id: resolveSecret(
      body.auth_net_api_login_id,
      existing?.auth_net_api_login_id
    ),
    auth_net_transaction_key: resolveSecret(
      body.auth_net_transaction_key,
      existing?.auth_net_transaction_key
    ),
    auth_net_public_client_key: resolvePlain(
      body.auth_net_public_client_key,
      existing?.auth_net_public_client_key
    ),

    bill_dot_com_environment:
      body.bill_dot_com_environment ??
      existing?.bill_dot_com_environment ??
      "sandbox",
    bill_dot_com_dev_key: resolveSecret(
      body.bill_dot_com_dev_key,
      existing?.bill_dot_com_dev_key
    ),
    bill_dot_com_username: resolvePlain(
      body.bill_dot_com_username,
      existing?.bill_dot_com_username
    ),
    bill_dot_com_password: resolveSecret(
      body.bill_dot_com_password,
      existing?.bill_dot_com_password
    ),
    bill_dot_com_org_id: resolvePlain(
      body.bill_dot_com_org_id,
      existing?.bill_dot_com_org_id
    ),

    updated_by: ctx.user_id,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin
    .from("org_payment_gateways")
    .upsert(payload, { onConflict: "org_id" });

  if (error) {
    return NextResponse.json(
      { error: "Failed to save gateway settings: " + error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
