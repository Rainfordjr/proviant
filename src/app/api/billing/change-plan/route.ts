import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { calculateProration } from "@/lib/proration";

function createAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) {
    return NextResponse.json({ error: "No org found" }, { status: 400 });
  }

  const body = await request.json();
  const { newPlanId } = body;

  if (!newPlanId) {
    return NextResponse.json({ error: "newPlanId required" }, { status: 400 });
  }

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
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
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
  const oldRate = sub?.billing_type === "plan"
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

  // Fetch old plan version id for the event log
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

  // 1. Log the subscription event
  const { data: event } = await admin
    .from("subscription_events")
    .insert({
      org_id: profile.org_id,
      event_type: "plan_change",
      previous_plan_id: oldPlanId,
      new_plan_id: newPlanId,
      previous_plan_version_id: oldVersionId,
      new_plan_version_id: newVersion?.id || null,
      previous_rate: oldRate,
      new_rate: newRate,
      days_remaining: proration?.daysRemaining ?? null,
      days_in_period: proration?.daysInPeriod ?? null,
      credit_amount: proration?.creditAmount ?? 0,
      charge_amount: proration?.chargeAmount ?? 0,
      net_amount: proration?.netAmount ?? 0,
      performed_by: user.id,
      notes: proration
        ? `Prorated: ${proration.daysRemaining} days remaining. Credit $${proration.creditAmount.toFixed(2)}, Charge $${proration.chargeAmount.toFixed(2)}, Net $${proration.netAmount.toFixed(2)}`
        : "Initial plan selection",
    })
    .select()
    .single();

  // 2. Create a prorated invoice if there's a net amount
  if (proration && proration.netAmount !== 0) {
    const { data: invoice } = await admin
      .from("billing_invoices")
      .insert({
        org_id: profile.org_id,
        period_start: now.toISOString(),
        period_end: sub!.current_period_end,
        amount: proration.netAmount,
        status: proration.netAmount > 0 ? "pending" : "paid",
        description: `Plan change proration: ${sub?.plans?.name || "Previous"} → ${newPlan.name}`,
      })
      .select()
      .single();

    // 3. Add line items to the invoice
    if (invoice) {
      const lineItems = [];

      if (proration.creditAmount > 0) {
        lineItems.push({
          invoice_id: invoice.id,
          description: `Credit: unused ${proration.daysRemaining} days on ${sub?.plans?.name || "previous plan"} ($${oldRate.toFixed(2)}/mo)`,
          line_type: "proration_credit",
          amount: -proration.creditAmount,
          event_id: event?.id || null,
        });
      }

      if (proration.chargeAmount > 0) {
        lineItems.push({
          invoice_id: invoice.id,
          description: `Charge: ${proration.daysRemaining} days on ${newPlan.name} ($${newRate.toFixed(2)}/mo)`,
          line_type: "proration_charge",
          amount: proration.chargeAmount,
          event_id: event?.id || null,
        });
      }

      if (lineItems.length > 0) {
        await admin.from("invoice_line_items").insert(lineItems);
      }
    }
  }

  // 4. Update the subscription
  if (sub) {
    await admin
      .from("org_subscriptions")
      .update({
        plan_id: newPlanId,
        plan_version_id: newVersion?.id || null,
        billing_type: "plan",
        status: sub.status === "trial" ? "trial" : "active",
        updated_at: now.toISOString(),
      })
      .eq("id", sub.id);
  } else {
    // Create new subscription
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await admin.from("org_subscriptions").insert({
      org_id: profile.org_id,
      plan_id: newPlanId,
      plan_version_id: newVersion?.id || null,
      billing_type: "plan",
      billing_cycle: "monthly",
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
    });
  }

  return NextResponse.json({
    success: true,
    proration: proration || null,
    event_id: event?.id || null,
  });
}
