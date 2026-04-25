import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/platformAdmin";

async function verifyPlatformAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_platform_admin) return null;
  return user;
}

// POST: Add a ledger entry
export async function POST(request: NextRequest) {
  const user = await verifyPlatformAdmin();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await request.json();
  const { org_id, entry_type, amount, description, reference_number, notes, invoice_id } = body;

  if (!org_id || !entry_type || amount === undefined || !description) {
    return NextResponse.json({ error: "org_id, entry_type, amount, and description required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get current balance
  const { data: balanceResult } = await admin.rpc("org_ledger_balance", { p_org_id: org_id });
  const currentBalance = Number(balanceResult || 0);
  const newBalance = Math.round((currentBalance + amount) * 100) / 100;

  // Insert the entry
  const { data: entry, error } = await admin
    .from("ledger_entries")
    .insert({
      org_id,
      entry_type,
      amount,
      running_balance: newBalance,
      description,
      reference_number: reference_number || null,
      notes: notes || null,
      invoice_id: invoice_id || null,
      performed_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, entry, balance: newBalance });
}
