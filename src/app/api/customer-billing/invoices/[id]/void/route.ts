import { NextRequest, NextResponse } from "next/server";
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
 * Void a customer invoice. The DB function refuses to void invoices that
 * have any payments applied — payments must be reversed first.
 */
export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

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

  // Tenant check: invoice must belong to this org.
  const admin = createAdmin();
  const { data: invoice } = await admin
    .from("customer_invoices")
    .select("id, org_id, status")
    .eq("id", id)
    .single();
  if (!invoice || invoice.org_id !== profile.org_id) {
    return NextResponse.json(
      { error: "Invoice not found" },
      { status: 404 }
    );
  }
  if (invoice.status === "void") {
    return NextResponse.json({ success: true, alreadyVoided: true });
  }

  const { error } = await admin.rpc("void_customer_invoice", {
    p_invoice_id: id,
  });

  if (error) {
    return NextResponse.json(
      { error: "Failed to void invoice: " + error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
