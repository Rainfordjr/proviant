import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, verifyPlatformAdminApi } from "@/lib/platformAdmin";
import { parseBody, uuid } from "@/lib/validation";

const LedgerEntrySchema = z.object({
  org_id: uuid(),
  entry_type: z.enum([
    "charge",
    "payment",
    "credit",
    "referral_credit",
    "adjustment",
    "refund",
  ]),
  amount: z.number().finite(),
  description: z.string().min(1),
  reference_number: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  invoice_id: uuid().optional().nullable(),
});

// POST: Add a ledger entry
export async function POST(request: NextRequest) {
  const auth = await verifyPlatformAdminApi();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const parsed = await parseBody(request, LedgerEntrySchema);
  if (!parsed.ok) return parsed.response;
  const { org_id, entry_type, amount, description, reference_number, notes, invoice_id } = parsed.data;

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
