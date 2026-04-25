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

// POST: Create a new plan
export async function POST(request: NextRequest) {
  const user = await verifyPlatformAdmin();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await request.json();
  const admin = createAdminClient();

  // Create the plan
  const { data: plan, error: planError } = await admin
    .from("plans")
    .insert({
      name: body.name,
      description: body.description || null,
      price_monthly: body.price_monthly,
      price_yearly: body.price_yearly || null,
      max_users: body.max_users || null,
      max_batches_per_month: body.max_batches_per_month || null,
      included_modules: body.included_modules || [],
      is_active: body.is_active ?? true,
      is_featured: body.is_featured ?? false,
      badge: body.badge || null,
      sort_order: body.sort_order ?? 0,
      current_version: 1,
    })
    .select()
    .single();

  if (planError) {
    return NextResponse.json({ error: planError.message }, { status: 500 });
  }

  // Create version 1 snapshot
  await admin.from("plan_versions").insert({
    plan_id: plan.id,
    version: 1,
    name: plan.name,
    description: plan.description,
    price_monthly: plan.price_monthly,
    price_yearly: plan.price_yearly,
    max_users: plan.max_users,
    max_batches_per_month: plan.max_batches_per_month,
    included_modules: plan.included_modules,
    change_notes: "Initial version",
    created_by: user.id,
  });

  return NextResponse.json({ success: true, plan });
}

// PUT: Update an existing plan (creates a new version)
export async function PUT(request: NextRequest) {
  const user = await verifyPlatformAdmin();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await request.json();
  const { planId, change_notes, ...fields } = body;

  if (!planId) {
    return NextResponse.json({ error: "planId required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get current plan to determine next version number
  const { data: currentPlan } = await admin
    .from("plans")
    .select("*")
    .eq("id", planId)
    .single();

  if (!currentPlan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const nextVersion = (currentPlan.current_version || 1) + 1;

  // Build the update payload — only include fields that were provided
  const updatePayload: Record<string, any> = {
    current_version: nextVersion,
    updated_at: new Date().toISOString(),
  };

  if (fields.name !== undefined) updatePayload.name = fields.name;
  if (fields.description !== undefined) updatePayload.description = fields.description;
  if (fields.price_monthly !== undefined) updatePayload.price_monthly = fields.price_monthly;
  if (fields.price_yearly !== undefined) updatePayload.price_yearly = fields.price_yearly;
  if (fields.max_users !== undefined) updatePayload.max_users = fields.max_users;
  if (fields.max_batches_per_month !== undefined) updatePayload.max_batches_per_month = fields.max_batches_per_month;
  if (fields.included_modules !== undefined) updatePayload.included_modules = fields.included_modules;
  if (fields.is_active !== undefined) updatePayload.is_active = fields.is_active;
  if (fields.is_featured !== undefined) updatePayload.is_featured = fields.is_featured;
  if (fields.badge !== undefined) updatePayload.badge = fields.badge;
  if (fields.sort_order !== undefined) updatePayload.sort_order = fields.sort_order;

  // Update the plan
  const { data: updatedPlan, error: updateError } = await admin
    .from("plans")
    .update(updatePayload)
    .eq("id", planId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Create a new version snapshot
  const { error: versionError } = await admin.from("plan_versions").insert({
    plan_id: planId,
    version: nextVersion,
    name: updatedPlan.name,
    description: updatedPlan.description,
    price_monthly: updatedPlan.price_monthly,
    price_yearly: updatedPlan.price_yearly,
    max_users: updatedPlan.max_users,
    max_batches_per_month: updatedPlan.max_batches_per_month,
    included_modules: updatedPlan.included_modules,
    change_notes: change_notes || null,
    created_by: user.id,
  });

  if (versionError) {
    return NextResponse.json({ error: versionError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, plan: updatedPlan, version: nextVersion });
}
