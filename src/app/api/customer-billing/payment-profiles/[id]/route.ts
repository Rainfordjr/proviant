import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireApiAuth } from "@/lib/api-auth";
import { deleteCustomerPaymentProfile } from "@/lib/gateways/auth-net";

function createAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * DELETE /api/customer-billing/payment-profiles/[id]
 *
 * Remove a saved card. Deletes from Authorize.Net first, then from our DB.
 * If the gateway delete fails (e.g., already gone there), we still clean up
 * our row.
 */
export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request, "customer_billing.manage");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const admin = createAdmin();

  // Tenant check.
  const { data: profile } = await admin
    .from("customer_payment_profiles")
    .select(
      "id, org_id, gateway, gateway_customer_id, gateway_payment_profile_id"
    )
    .eq("id", id)
    .maybeSingle();
  if (!profile || profile.org_id !== auth.org_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Look up org credentials so we can delete from Authorize.Net.
  const { data: gateways } = await admin
    .from("org_payment_gateways")
    .select(
      "auth_net_environment, auth_net_api_login_id, auth_net_transaction_key"
    )
    .eq("org_id", auth.org_id)
    .maybeSingle();

  if (
    profile.gateway === "authorize_net" &&
    gateways?.auth_net_api_login_id &&
    gateways?.auth_net_transaction_key
  ) {
    await deleteCustomerPaymentProfile(
      {
        environment: gateways.auth_net_environment as "sandbox" | "production",
        apiLoginId: gateways.auth_net_api_login_id,
        transactionKey: gateways.auth_net_transaction_key,
      },
      profile.gateway_customer_id,
      profile.gateway_payment_profile_id
    );
    // Best effort — if it fails (already deleted on their side, etc.) we
    // still want our row gone.
  }

  await admin.from("customer_payment_profiles").delete().eq("id", id);

  return NextResponse.json({ success: true });
}
