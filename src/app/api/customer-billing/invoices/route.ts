import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requirePermissionApi } from "@/lib/permissions";
import { parseBody, uuid } from "@/lib/validation";

function createAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const LineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
  product_id: uuid().optional().nullable(),
  order_item_id: uuid().optional().nullable(),
});

const CreateInvoiceSchema = z.object({
  customer_id: uuid(),
  issued_at: z.string().datetime().optional(),
  due_at: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  order_id: uuid().optional().nullable(),
  line_items: z.array(LineItemSchema).min(1),
});

/**
 * Create a manual customer invoice with line items.
 * Auto-invoices from confirmed orders are created by a DB trigger; this
 * route is for the user-initiated case (e.g. "add a charge for X" from
 * the customer detail page).
 */
export async function POST(request: NextRequest) {
  const auth = await requirePermissionApi("customer_billing.manage");
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const parsed = await parseBody(request, CreateInvoiceSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  // Resolve caller's org
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile?.org_id) {
    return NextResponse.json({ error: "No org found" }, { status: 400 });
  }

  // Verify the customer belongs to the caller's org. The SQL function is
  // SECURITY DEFINER so it doesn't enforce this; we have to.
  const admin = createAdmin();
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

  const { data: result, error } = await admin.rpc("create_customer_invoice", {
    p_org_id: profile.org_id,
    p_customer_id: body.customer_id,
    p_kind: "invoice",
    p_issued_at: body.issued_at ?? null,
    p_due_at: body.due_at ?? null,
    p_notes: body.notes ?? null,
    p_order_id: body.order_id ?? null,
    p_line_items: body.line_items,
  });

  if (error) {
    return NextResponse.json(
      { error: "Failed to create invoice: " + error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, ...(result as object) });
}
