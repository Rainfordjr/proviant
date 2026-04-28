import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, verifyPlatformAdminApi } from "@/lib/platformAdmin";
import { parseBody, uuid } from "@/lib/validation";

const ReferralSchema = z
  .object({
    referrer_org_id: uuid(),
    referred_org_id: uuid(),
    credit_rate: z.number().min(0).max(1).optional(),
  })
  .refine((data) => data.referrer_org_id !== data.referred_org_id, {
    message: "An org cannot refer itself",
    path: ["referred_org_id"],
  });

/**
 * POST: Create a new referral relationship between two orgs.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyPlatformAdminApi();
  if (!auth.ok) return auth.response;

  const parsed = await parseBody(request, ReferralSchema);
  if (!parsed.ok) return parsed.response;
  const { referrer_org_id, referred_org_id, credit_rate } = parsed.data;

  const admin = createAdminClient();

  // Check if referred org is already referred
  const { data: existing } = await admin
    .from("referrals")
    .select("id")
    .eq("referred_org_id", referred_org_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "This org has already been referred" }, { status: 400 });
  }

  // Get referrer org's referral code
  const { data: referrerOrg } = await admin
    .from("organizations")
    .select("referral_code")
    .eq("id", referrer_org_id)
    .single();

  // Create the referral
  const { data: referral, error } = await admin
    .from("referrals")
    .insert({
      referrer_org_id,
      referred_org_id,
      referral_code: referrerOrg?.referral_code || "MANUAL",
      credit_rate: credit_rate || 0.10,
      status: "active",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mark the referred org's referred_by
  await admin
    .from("organizations")
    .update({ referred_by: referrer_org_id })
    .eq("id", referred_org_id);

  return NextResponse.json({ success: true, referral });
}
