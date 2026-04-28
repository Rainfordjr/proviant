import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requirePermissionApi } from "@/lib/permissions";
import { parseBody, uuid } from "@/lib/validation";
import { withIdempotency } from "@/lib/idempotency";

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

const PaymentSchema = z.object({
  customer_id: uuid(),
  amount: z.number().positive(),
  method: z.enum(["cash", "check", "card", "ach", "other"]).default("other"),
  reference_number: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  received_at: z.string().datetime().optional(),
  applications: z.array(ApplicationSchema).optional().default([]),
});

/**
 * Record a payment from a customer, optionally applied to one or more
 * specific invoices. The atomic SQL function inserts the payment row,
 * each application row, and recomputes invoice statuses in a single txn.
 *
 * Wrapped in withIdempotency so a retried submit (Idempotency-Key header)
 * doesn't double-record the payment.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePermissionApi("customer_billing.manage");
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const parsed = await parseBody(request, PaymentSchema);
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

  // Tenant check on the customer.
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

  // Tenant check on every applied invoice. Must belong to this org and
  // not be voided.
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

  const idem = await withIdempotency(request, "customer_payment", {
    orgId: profile.org_id,
    userId: user.id,
  });
  if (!idem.ok) return idem.response;
  if (idem.cached) return idem.response;
  const { finish } = idem;

  const { data: result, error } = await admin.rpc("record_customer_payment", {
    p_org_id: profile.org_id,
    p_customer_id: body.customer_id,
    p_amount: body.amount,
    p_method: body.method,
    p_reference_number: body.reference_number ?? null,
    p_notes: body.notes ?? null,
    p_received_at: body.received_at ?? null,
    p_recorded_by: user.id,
    p_applications: body.applications,
  });

  if (error) {
    return finish(500, {
      error: "Failed to record payment: " + error.message,
    });
  }

  return finish(200, { success: true, ...(result as object) });
}
