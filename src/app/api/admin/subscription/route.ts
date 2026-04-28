import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, verifyPlatformAdminApi } from "@/lib/platformAdmin";
import { parseBody, uuid } from "@/lib/validation";

const SubscriptionSchema = z.object({
  orgId: uuid(),
  subscriptionId: uuid().optional(),
  billing_type: z.enum(["plan", "custom"]),
  plan_id: uuid().optional().nullable(),
  custom_rate_monthly: z.number().nonnegative().optional().nullable(),
  custom_rate_yearly: z.number().nonnegative().optional().nullable(),
  custom_notes: z.string().optional().nullable(),
  billing_cycle: z.enum(["monthly", "yearly"]),
  status: z.enum(["trial", "active", "past_due", "cancelled", "suspended"]),
});

export async function POST(request: NextRequest) {
  // Verify the caller is a platform admin
  const auth = await verifyPlatformAdminApi();
  if (!auth.ok) return auth.response;

  const parsed = await parseBody(request, SubscriptionSchema);
  if (!parsed.ok) return parsed.response;
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
  } = parsed.data;

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
