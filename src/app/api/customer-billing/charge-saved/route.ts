import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireApiAuth } from "@/lib/api-auth";
import { parseBody, uuid } from "@/lib/validation";
import { withIdempotency } from "@/lib/idempotency";
import { chargeCustomerProfile } from "@/lib/gateways/auth-net";

function createAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const ApplicationSchema = z.object({
  invoice_id: uuid(),
  amount: z.number().positive(),
});

const ChargeSavedSchema = z.object({
  payment_profile_id: uuid(),
  amount: z.number().positive(),
  description: z.string().optional(),
  notes: z.string().optional().nullable(),
  applications: z.array(ApplicationSchema).optional().default([]),
});

/**
 * POST /api/customer-billing/charge-saved
 *
 * Charge a card already on file. The browser only sends the saved
 * payment_profile_id — never any card data.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, "customer_billing.manage");
  if (!auth.ok) return auth.response;
  const { user_id_for_log } = { user_id_for_log: auth.kind === "user" ? auth.user.id : null };

  const parsed = await parseBody(request, ChargeSavedSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const admin = createAdmin();

  // 1. Tenant-check the payment profile + pluck its customer + gateway IDs.
  const { data: profile } = await admin
    .from("customer_payment_profiles")
    .select(
      "id, org_id, customer_id, gateway, gateway_customer_id, gateway_payment_profile_id, card_type, card_last4"
    )
    .eq("id", body.payment_profile_id)
    .maybeSingle();
  if (!profile || profile.org_id !== auth.org_id) {
    return NextResponse.json({ error: "Saved card not found" }, { status: 404 });
  }
  if (profile.gateway !== "authorize_net") {
    return NextResponse.json(
      { error: "Saved card uses an unsupported gateway: " + profile.gateway },
      { status: 400 }
    );
  }

  // 2. Tenant-check every applied invoice.
  if (body.applications.length > 0) {
    const ids = body.applications.map((a) => a.invoice_id);
    const { data: invoices } = await admin
      .from("customer_invoices")
      .select("id, org_id, status")
      .in("id", ids);
    const byId = new Map((invoices ?? []).map((i) => [i.id, i]));
    for (const id of ids) {
      const inv = byId.get(id);
      if (!inv || inv.org_id !== auth.org_id) {
        return NextResponse.json(
          { error: `Invoice ${id} not found in your organization` },
          { status: 404 }
        );
      }
      if (inv.status === "void") {
        return NextResponse.json(
          { error: `Cannot apply payment to voided invoice ${id}` },
          { status: 400 }
        );
      }
    }
  }

  // 3. Look up org's Authorize.Net credentials.
  const { data: gateways } = await admin
    .from("org_payment_gateways")
    .select(
      "auth_net_environment, auth_net_api_login_id, auth_net_transaction_key"
    )
    .eq("org_id", auth.org_id)
    .maybeSingle();
  if (
    !gateways?.auth_net_api_login_id ||
    !gateways?.auth_net_transaction_key
  ) {
    return NextResponse.json(
      { error: "Authorize.Net is not configured for this organization." },
      { status: 400 }
    );
  }

  const idem = await withIdempotency(request, "card_charge_saved", {
    orgId: auth.org_id,
    userId: user_id_for_log,
  });
  if (!idem.ok) return idem.response;
  if (idem.cached) return idem.response;
  const { finish } = idem;

  // 4. Run the charge against the saved profile.
  const charge = await chargeCustomerProfile(
    {
      environment: gateways.auth_net_environment as "sandbox" | "production",
      apiLoginId: gateways.auth_net_api_login_id,
      transactionKey: gateways.auth_net_transaction_key,
    },
    {
      customerProfileId: profile.gateway_customer_id,
      customerPaymentProfileId: profile.gateway_payment_profile_id,
      amount: body.amount,
      description:
        body.description ?? `Charge to ${profile.card_type} •••• ${profile.card_last4}`,
    }
  );

  if (!charge.ok) {
    return finish(402, {
      error: charge.message,
      gateway: "authorize_net",
      response_code: charge.responseCode,
    });
  }

  // 5. Record the payment via the atomic SQL function.
  const { data: rpcResult, error: rpcErr } = await admin.rpc(
    "record_customer_payment",
    {
      p_org_id: auth.org_id,
      p_customer_id: profile.customer_id,
      p_amount: body.amount,
      p_method: "card",
      p_reference_number: charge.transactionId ?? null,
      p_notes: body.notes ?? null,
      p_received_at: null,
      p_recorded_by: user_id_for_log,
      p_applications: body.applications,
    }
  );

  if (rpcErr) {
    return finish(500, {
      error: "Card was charged but local record failed: " + rpcErr.message,
      gateway_transaction_id: charge.transactionId,
    });
  }

  const payment_id = (rpcResult as { payment_id?: string } | null)?.payment_id;

  if (payment_id) {
    await admin
      .from("customer_payments")
      .update({
        gateway: "authorize_net",
        gateway_transaction_id: charge.transactionId ?? null,
        gateway_status: "cleared",
        gateway_metadata: charge.raw as object,
      })
      .eq("id", payment_id);
  }

  return finish(200, {
    success: true,
    payment_id,
    gateway: "authorize_net",
    gateway_transaction_id: charge.transactionId,
    auth_code: charge.authCode,
    message: charge.message,
    card: { type: profile.card_type, last4: profile.card_last4 },
  });
}
