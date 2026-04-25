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

/**
 * Record a payment for an org. This:
 * 1. Creates a ledger entry (payment)
 * 2. Marks the linked invoice as paid (if provided)
 * 3. Checks if this org was referred — if so, gives the referrer a 10% credit
 */
export async function POST(request: NextRequest) {
  const user = await verifyPlatformAdmin();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await request.json();
  const { org_id, amount, description, reference_number, notes, invoice_id } = body;

  if (!org_id || !amount || !description) {
    return NextResponse.json({ error: "org_id, amount, and description required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. Get current balance and create the payment ledger entry
  const { data: balanceResult } = await admin.rpc("org_ledger_balance", { p_org_id: org_id });
  const currentBalance = Number(balanceResult || 0);
  // Payments reduce the balance (negative amount)
  const paymentAmount = -Math.abs(amount);
  const newBalance = Math.round((currentBalance + paymentAmount) * 100) / 100;

  const { data: entry, error: entryError } = await admin
    .from("ledger_entries")
    .insert({
      org_id,
      entry_type: "payment",
      amount: paymentAmount,
      running_balance: newBalance,
      description,
      reference_number: reference_number || null,
      notes: notes || null,
      invoice_id: invoice_id || null,
      performed_by: user.id,
    })
    .select()
    .single();

  if (entryError) {
    return NextResponse.json({ error: entryError.message }, { status: 500 });
  }

  // 2. Mark invoice as paid if provided
  if (invoice_id) {
    await admin
      .from("billing_invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", invoice_id);
  }

  // 3. Check for referral — give the referrer a 10% credit
  let referralCredit = null;
  const { data: referral } = await admin
    .from("referrals")
    .select("*")
    .eq("referred_org_id", org_id)
    .eq("status", "active")
    .maybeSingle();

  if (referral) {
    const creditAmount = Math.round(Math.abs(amount) * referral.credit_rate * 100) / 100;

    if (creditAmount > 0) {
      // Get referrer's current balance
      const { data: refBalance } = await admin.rpc("org_ledger_balance", { p_org_id: referral.referrer_org_id });
      const refCurrentBalance = Number(refBalance || 0);
      const refNewBalance = Math.round((refCurrentBalance + (-creditAmount)) * 100) / 100;

      // Create referral credit entry on the referrer's ledger
      await admin.from("ledger_entries").insert({
        org_id: referral.referrer_org_id,
        entry_type: "referral_credit",
        amount: -creditAmount,  // negative = reduces what they owe
        running_balance: refNewBalance,
        description: `Referral credit: 10% of payment from referred organization`,
        referral_id: referral.id,
        performed_by: user.id,
      });

      // Update total credits earned on the referral record
      await admin
        .from("referrals")
        .update({
          total_credits_earned: Number(referral.total_credits_earned) + creditAmount,
        })
        .eq("id", referral.id);

      referralCredit = { referrer_org_id: referral.referrer_org_id, creditAmount };
    }
  }

  return NextResponse.json({
    success: true,
    entry,
    balance: newBalance,
    referralCredit,
  });
}
