import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";
import { calculateProration } from "@/lib/proration";
import { requirePermissionApi } from "@/lib/permissions";
import { parseBody, uuid } from "@/lib/validation";
import { withIdempotency } from "@/lib/idempotency";

function createAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const ChangePlanSchema = z.object({
  newPlanId: uuid(),
});

export async function POST(request: NextRequest) {
  // Gate: caller must be authenticated AND hold billing.manage.
  const auth = await requirePermissionApi("billing.manage");
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const parsed = await parseBody(request, ChangePlanSchema);
  if (!parsed.ok) return parsed.response;
  const { newPlanId } = parsed.data;

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) {
    return NextResponse.json({ error: "No org found" }, { status: 400 });
  }

  // Idempotency: clients may send Idempotency-Key to make this safe to retry.
  // (No header = no dedup, but no work duplicated by accidental double-clicks
  //  with a key.)
  const idem = await withIdempotency(request, "change_plan", {
    orgId: profile.org_id,
    userId: user.id,
  });
  if (!idem.ok) return idem.response;
  if (idem.cached) return idem.response;
  const { finish } = idem;

  const admin = createAdmin();

  // Fetch current subscription
  const { data: sub } = await admin
    .from("org_subscriptions")
    .select("*, plans(*)")
    .eq("org_id", profile.org_id)
    .maybeSingle();

  // Fetch new plan
  const { data: newPlan } = await admin
    .from("plans")
    .select("*")
    .eq("id", newPlanId)
    .single();

  if (!newPlan) {
    return finish(404, { error: "Plan not found" });
  }

  // Fetch latest version of the new plan
  const { data: newVersion } = await admin
    .from("plan_versions")
    .select("id")
    .eq("plan_id", newPlanId)
    .eq("version", newPlan.current_version)
    .single();

  const now = new Date();
  const oldPlanId = sub?.plan_id || null;
  const oldRate =
    sub?.billing_type === "plan"
      ? Number(sub.plans?.price_monthly || 0)
      : Number(sub?.custom_rate_monthly || 0);
  const newRate = Number(newPlan.price_monthly);

  // Calculate proration if there's an existing subscription with time remaining
  let proration = null;
  if (sub && sub.current_period_start && sub.current_period_end) {
    proration = calculateProration(
      oldRate,
      newRate,
      new Date(sub.current_period_start),
      new Date(sub.current_period_end),
      now
    );
  }

  // Resolve old plan version id for the event log
  let oldVersionId = sub?.plan_version_id || null;
  if (!oldVersionId && oldPlanId) {
    const { data: oldPlan } = await admin
      .from("plans")
      .select("current_version")
      .eq("id", oldPlanId)
      .single();
    if (oldPlan) {
      const { data: ov } = await admin
        .from("plan_versions")
        .select("id")
        .eq("plan_id", oldPlanId)
        .eq("version", oldPlan.current_version)
        .single();
      if (ov) oldVersionId = ov.id;
    }
  }

  // Atomic write: subscription_event + (optional) invoice + line_items + sub upsert.
  // Implemented as a Postgres function so a mid-sequence failure rolls everything back.
  const { data: result, error: rpcError } = await admin.rpc("apply_plan_change", {
    p_org_id: profile.org_id,
    p_subscription_id: sub?.id ?? null,
    p_old_plan_id: oldPlanId,
    p_new_plan_id: newPlanId,
    p_old_version_id: oldVersionId,
    p_new_version_id: newVersion?.id ?? null,
    p_old_rate: oldRate,
    p_new_rate: newRate,
    p_old_plan_name: sub?.plans?.name ?? null,
    p_new_plan_name: newPlan.name,
    p_days_remaining: proration?.daysRemaining ?? null,
    p_days_in_period: proration?.daysInPeriod ?? null,
    p_credit_amount: proration?.creditAmount ?? null,
    p_charge_amount: proration?.chargeAmount ?? null,
    p_net_amount: proration?.netAmount ?? null,
    p_current_period_end: sub?.current_period_end ?? null,
    p_keep_trial: sub?.status === "trial",
    p_performed_by: user.id,
  });

  if (rpcError) {
    return finish(500, { error: "Plan change failed: " + rpcError.message });
  }

  return finish(200, {
    success: true,
    proration: proration ?? null,
    event_id: (result as { event_id?: string } | null)?.event_id ?? null,
    invoice_id: (result as { invoice_id?: string | null } | null)?.invoice_id ?? null,
  });
}
