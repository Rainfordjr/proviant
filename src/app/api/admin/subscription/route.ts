import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/platformAdmin";

export async function POST(request: NextRequest) {
  // Verify the caller is a platform admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_platform_admin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await request.json();
  const {
    orgId,
    subscriptionId,
    billing_type,
    plan_id,
    custom_rate_monthly,
    custom_rate_yearly,
    custom_notes,
    billing_cycle,
    status,
  } = body;

  const admin = createAdminClient();

  const payload = {
    org_id: orgId,
    billing_type,
    plan_id: plan_id || null,
    custom_rate_monthly: custom_rate_monthly ?? null,
    custom_rate_yearly: custom_rate_yearly ?? null,
    custom_notes: custom_notes || null,
    billing_cycle,
    status,
    updated_at: new Date().toISOString(),
  };

  if (subscriptionId) {
    // Update existing
    const { error } = await admin
      .from("org_subscriptions")
      .update(payload)
      .eq("id", subscriptionId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    // Create new subscription
    const periodEnd = new Date();
    if (billing_cycle === "yearly") {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const { error } = await admin.from("org_subscriptions").insert({
      ...payload,
      current_period_start: new Date().toISOString(),
      current_period_end: periodEnd.toISOString(),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
