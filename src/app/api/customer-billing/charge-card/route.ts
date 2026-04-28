import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requirePermissionApi } from "@/lib/permissions";
import { parseBody, uuid } from "@/lib/validation";
import { withIdempotency } from "@/lib/idempotency";
import { chargeOpaqueCard } from "@/lib/gateways/auth-net";

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

const ChargeCardSchema = z.object({
  customer_id: uuid(),
  amount: z.number().positive(),
  // Opaque token from Authorize.Net Accept.js
  opaque_data: z.object({
    dataDescriptor: z.string().min(1),
    dataValue: z.string().min(1),
  }),
  invoice_number: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional().nullable(),
  applications: z.array(ApplicationSchema).optional().default([]),
});

/**
 * Charge a card via Authorize.Net (using an Accept.js opaque token), then
 * record the resulting payment + apply to invoices atomically.
 *
 * The card itself never touches our servers — Accept.js tokenizes it in
 * the browser and we forward the opaque blob to Authorize.Net.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePermissionApi("customer_billing.manage");
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const parsed = await parseBody(request, ChargeCardSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

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

  // Tenant-check the customer.
  const { data: customer } = await admin
    .from("customers")
    .select("id, org_id")
    .eq("id", body.customer_id)
    .single();
  if (!customer || customer.org_id !== profile.org_id) {
    return NextResponse.json(
      { error: "Customer not found in your organization" },
      { status: 404 }
    );
  }

  // Tenant-check every applied invoice.
  if (body.applications.length > 0) {
    const ids = body.applications.map((a) => a.invoice_id);
    const { data: invoices } = await admin
      .from("customer_invoices")
      .select("id, org_id, status")
      .in("id", ids);
    const byId = new Map((invoices ?? []).map((i) => [i.id, i]));
    for (const id of ids) {
      const inv = byId.get(id);
      if (!inv || inv.org_id !== profile.org_id) {
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

  // Look up the org's Authorize.Net credentials.
  const { data: gateways } = await admin
    .from("org_payment_gateways")
    .select(
      "auth_net_environment, auth_net_api_login_id, auth_net_transaction_key"
    )
    .eq("org_id", profile.org_id)
    .maybeSingle();
  if (
    !gateways?.auth_net_api_login_id ||
    !gateways?.auth_net_transaction_key
  ) {
    return NextResponse.json(
      {
        error:
          "Authorize.Net is not configured. Visit Settings → Payment Gateways to add credentials.",
      },
      { status: 400 }
    );
  }

  const idem = await withIdempotency(request, "card_charge", {
    orgId: profile.org_id,
    userId: user.id,
  });
  if (!idem.ok) return idem.response;
  if (idem.cached) return idem.response;
  const { finish } = idem;

  // 1. Run the charge.
  const charge = await chargeOpaqueCard(
    {
      environment: gateways.auth_net_environment as "sandbox" | "production",
      apiLoginId: gateways.auth_net_api_login_id,
      transactionKey: gateways.auth_net_transaction_key,
    },
    {
      amount: body.amount,
      opaqueData: body.opaque_data,
      invoiceNumber: body.invoice_number,
      description: body.description,
    }
  );

  if (!charge.ok) {
    // Don't write a payment row on decline — just surface the gateway message.
    return finish(402, {
      error: charge.message,
      gateway: "authorize_net",
      response_code: charge.responseCode,
    });
  }

  // 2. Record the payment via the atomic SQL function. Then patch the row
  //    with gateway-specific fields. Two writes, but the second can't fail
  //    in a way that leaves bad ledger state — gateway columns are metadata.
  const { data: rpcResult, error: rpcErr } = await admin.rpc(
    "record_customer_payment",
    {
      p_org_id: profile.org_id,
      p_customer_id: body.customer_id,
      p_amount: body.amount,
      p_method: "card",
      p_reference_number: charge.transactionId ?? null,
      p_notes: body.notes ?? null,
      p_received_at: null,
      p_recorded_by: user.id,
      p_applications: body.applications,
    }
  );

  if (rpcErr) {
    // Card was charged but we couldn't record. Surface loudly so the user can
    // reconcile manually; the txn id is in the response.
    return finish(500, {
      error: "Card was charged but we failed to record the payment locally.",
      details: rpcErr.message,
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
  });
}
