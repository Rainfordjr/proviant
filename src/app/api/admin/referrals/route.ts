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
 * POST: Create a new referral relationship between two orgs.
 */
export async function POST(request: NextRequest) {
  const user = await verifyPlatformAdmin();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await request.json();
  const { referrer_org_id, referred_org_id, credit_rate } = body;

  if (!referrer_org_id || !referred_org_id) {
    return NextResponse.json({ error: "referrer_org_id and referred_org_id required" }, { status: 400 });
  }

  if (referrer_org_id === referred_org_id) {
    return NextResponse.json({ error: "An org cannot refer itself" }, { status: 400 });
  }

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
