import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requirePermissionApi } from "@/lib/permissions";
import { parseBody, uuid } from "@/lib/validation";
import { withIdempotency } from "@/lib/idempotency";
import { initiateAchTransfer } from "@/lib/gateways/bill-dot-com";

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

const InitiateAchSchema = z.object({
  customer_id: uuid(),
  amount: z.number().positive(),
  routing_number: z.string().regex(/^\d{9}$/, "Routing number must be 9 digits"),
  account_number: z.string().min(4),
  account_holder_name: z.string().min(1),
  account_type: z.enum(["checking", "savings"]),
  description: z.string().optional(),
  notes: z.string().optional().nullable(),
  applications: z.array(ApplicationSchema).optional().default([]),
});

/**
 * Initiate an ACH transfer through Bill.com.
 *
 * v1: the actual Bill.com submission is stubbed (see lib/gateways/bill-dot-com.ts).
 * The route still records a customer_payments row with gateway='bill_dot_com'
 * and gateway_status='pending' so the customer's balance reflects the
 * pending payment. When the real Bill.com integration is wired, settlement
 * webhooks will flip the row to 'cleared' or 'failed'.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePermissionApi("customer_billing.manage");
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const parsed = await parseBody(request, InitiateAchSchema);
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

  // Tenant checks (same shape as charge-card).
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

  const { data: gateways } = await admin
    .from("org_payment_gateways")
    .select(
      "bill_dot_com_environment, bill_dot_com_dev_key, bill_dot_com_username, bill_dot_com_password, bill_dot_com_org_id"
    )
    .eq("org_id", profile.org_id)
    .maybeSingle();
  if (
    !gateways?.bill_dot_com_dev_key ||
    !gateways?.bill_dot_com_username ||
    !gateways?.bill_dot_com_password
  ) {
    return NextResponse.json(
      {
        error:
          "Bill.com is not configured. Visit Settings → Payment Gateways to add credentials.",
      },
      { status: 400 }
    );
  }

  const idem = await withIdempotency(request, "ach_initiate", {
    orgId: profile.org_id,
    userId: user.id,
  });
  if (!idem.ok) return idem.response;
  if (idem.cached) return idem.response;
  const { finish } = idem;

  const result = await initiateAchTransfer(
    {
      environment: gateways.bill_dot_com_environment as "sandbox" | "production",
      devKey: gateways.bill_dot_com_dev_key,
      username: gateways.bill_dot_com_username,
      password: gateways.bill_dot_com_password,
      orgId: gateways.bill_dot_com_org_id ?? "",
    },
    {
      amount: body.amount,
      routingNumber: body.routing_number,
      accountNumber: body.account_number,
      accountHolderName: body.account_holder_name,
      accountType: body.account_type,
      description: body.description,
    }
  );

  if (!result.ok) {
    return finish(400, {
      error: result.message,
      gateway: "bill_dot_com",
    });
  }

  const { data: rpcResult, error: rpcErr } = await admin.rpc(
    "record_customer_payment",
    {
      p_org_id: profile.org_id,
      p_customer_id: body.customer_id,
      p_amount: body.amount,
      p_method: "ach",
      p_reference_number: result.transactionId ?? null,
      p_notes: body.notes ?? null,
      p_received_at: null,
      p_recorded_by: user.id,
      p_applications: body.applications,
    }
  );

  if (rpcErr) {
    return finish(500, {
      error: "ACH submitted but local recording failed: " + rpcErr.message,
      gateway_transaction_id: result.transactionId,
    });
  }

  const payment_id = (rpcResult as { payment_id?: string } | null)?.payment_id;

  if (payment_id) {
    await admin
      .from("customer_payments")
      .update({
        gateway: "bill_dot_com",
        gateway_transaction_id: result.transactionId ?? null,
        gateway_status: result.status, // 'pending' until settled
        gateway_metadata: result.raw as object,
      })
      .eq("id", payment_id);
  }

  return finish(200, {
    success: true,
    payment_id,
    gateway: "bill_dot_com",
    gateway_transaction_id: result.transactionId,
    status: result.status,
    message: result.message,
  });
}
