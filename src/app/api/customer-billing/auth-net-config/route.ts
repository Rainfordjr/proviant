import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requirePermissionApi } from "@/lib/permissions";

function createAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Returns the Authorize.Net fields that need to be available client-side
 * for Accept.js tokenization: API Login ID + public client key. The
 * transaction key never leaves the server.
 *
 * Both apiLoginID and clientKey are required by Accept.js to tokenize a
 * card; they're public-by-design (Authorize.Net's threat model assumes
 * they may be exposed). The transaction key is what protects against
 * unauthorized charges.
 */
export async function GET() {
  const auth = await requirePermissionApi("customer_billing.manage");
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile?.org_id) {
    return NextResponse.json({ error: "No org found" }, { status: 400 });
  }

  const admin = createAdmin();
  const { data: row } = await admin
    .from("org_payment_gateways")
    .select(
      "auth_net_environment, auth_net_api_login_id, auth_net_public_client_key"
    )
    .eq("org_id", profile.org_id)
    .maybeSingle();

  if (
    !row?.auth_net_api_login_id ||
    !row?.auth_net_public_client_key
  ) {
    return NextResponse.json({ configured: false });
  }

  return NextResponse.json({
    configured: true,
    environment: row.auth_net_environment ?? "sandbox",
    api_login_id: row.auth_net_api_login_id,
    public_client_key: row.auth_net_public_client_key,
  });
}
