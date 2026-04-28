import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient, verifyPlatformAdminApi } from "@/lib/platformAdmin";
import { parseBody, uuid } from "@/lib/validation";
import { withIdempotency } from "@/lib/idempotency";

const RecordPaymentSchema = z.object({
  org_id: uuid(),
  amount: z.number().positive(),
  description: z.string().min(1),
  reference_number: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  invoice_id: uuid().optional().nullable(),
});

/**
 * Record a payment for an org. The work is delegated to the
 * record_payment_with_referral() Postgres function, which performs all
 * three writes (payment ledger entry + invoice mark-paid + referral
 * credit) in a single transaction. Wrapped in withIdempotency so a
 * client-supplied Idempotency-Key prevents double-charging on retry.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyPlatformAdminApi();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const parsed = await parseBody(request, RecordPaymentSchema);
  if (!parsed.ok) return parsed.response;
  const {
    org_id,
    amount,
    description,
    reference_number,
    notes,
    invoice_id,
  } = parsed.data;

  const idem = await withIdempotency(request, "record_payment", {
    orgId: org_id,
    userId: user.id,
  });
  if (!idem.ok) return idem.response;
  if (idem.cached) return idem.response;
  const { finish } = idem;

  const admin = createAdminClient();

  const { data: result, error: rpcError } = await admin.rpc(
    "record_payment_with_referral",
    {
      p_org_id: org_id,
      p_amount: amount,
      p_description: description,
      p_reference_number: reference_number ?? null,
      p_notes: notes ?? null,
      p_invoice_id: invoice_id ?? null,
      p_performed_by: user.id,
    }
  );

  if (rpcError) {
    return finish(500, { error: "Payment failed: " + rpcError.message });
  }

  // Function returns { payment_id, balance, referral_credit }.
  const r = (result ?? {}) as {
    payment_id?: string;
    balance?: number;
    referral_credit?: {
      referrer_org_id: string;
      credit_amount: number;
      credit_entry_id: string;
    } | null;
  };

  return finish(200, {
    success: true,
    payment_id: r.payment_id ?? null,
    balance: r.balance ?? null,
    referralCredit: r.referral_credit ?? null,
  });
}
