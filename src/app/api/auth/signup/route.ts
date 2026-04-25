import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Use service role key to bypass RLS for signup operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName, orgName, planId, referralCode } = await request.json();

    // 1. Create the auth user
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm for local dev
        user_metadata: { full_name: fullName, org_name: orgName },
      });

    if (authError) {
      // AuthError extends Error — message is on the prototype chain
      const msg = String(authError.message || "")
        || (authError as any).code
        || (authError as any).status
        || `Auth error (${authError.name})`;
      console.error("Signup auth error:", msg, "| status:", (authError as any).status, "| code:", (authError as any).code);
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (!authData?.user) {
      return NextResponse.json({ error: "No user returned from auth service" }, { status: 500 });
    }

    // 2. Look up referrer org if a referral code was provided
    let referrerOrgId: string | null = null;
    if (referralCode) {
      const { data: referrerOrg } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("referral_code", referralCode.trim().toUpperCase())
        .maybeSingle();
      if (referrerOrg) {
        referrerOrgId = referrerOrg.id;
      }
    }

    // 3. Generate a referral code for the new org
    const newReferralCode =
      orgName.replace(/[^a-zA-Z0-9]/g, "").substring(0, 4).toUpperCase() +
      "-" +
      String(Math.floor(Math.random() * 10000)).padStart(4, "0");

    // 4. Create the organization
    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: orgName,
        referral_code: newReferralCode,
        referred_by: referrerOrgId,
      })
      .select()
      .single();

    if (orgError) {
      // Clean up: delete the auth user if org creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: "Failed to create organization: " + orgError.message },
        { status: 500 }
      );
    }

    // 5. Create the user profile
    const { error: profileError } = await supabaseAdmin
      .from("users")
      .insert({
        id: authData.user.id,
        org_id: org.id,
        email: email,
        full_name: fullName,
        role: "admin",
      });

    if (profileError) {
      // Clean up
      await supabaseAdmin.from("organizations").delete().eq("id", org.id);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: "Failed to create user profile: " + profileError.message },
        { status: 500 }
      );
    }

    // 6. Create an Administrator role for this org and assign it to the founder
    const { data: adminRole } = await supabaseAdmin
      .from("roles")
      .insert({
        org_id: org.id,
        name: "Administrator",
        description: "Full access to all features",
        is_system: true,
        is_admin: true,
      })
      .select()
      .single();

    if (adminRole) {
      // Assign the admin role to the founding user
      await supabaseAdmin.from("user_roles").insert({
        user_id: authData.user.id,
        role_id: adminRole.id,
      });

      // Grant all permissions to the admin role
      const { data: allPerms } = await supabaseAdmin
        .from("permissions")
        .select("id");

      if (allPerms && allPerms.length > 0) {
        await supabaseAdmin.from("role_permissions").insert(
          allPerms.map((p: { id: string }) => ({
            role_id: adminRole.id,
            permission_id: p.id,
          }))
        );
      }
    }

    // 7. Activate all core modules for the new org
    const { data: coreModules } = await supabaseAdmin
      .from("modules")
      .select("id")
      .eq("is_core", true);

    if (coreModules && coreModules.length > 0) {
      await supabaseAdmin.from("org_modules").insert(
        coreModules.map((m: { id: string }) => ({
          org_id: org.id,
          module_id: m.id,
          is_active: true,
          activated_by: authData.user.id,
        }))
      );
    }

    // 8. Create subscription with selected plan (14-day free trial)
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    // Look up the selected plan to get its version
    let planVersionId: string | null = null;
    if (planId) {
      const { data: planData } = await supabaseAdmin
        .from("plans")
        .select("id, current_version")
        .eq("id", planId)
        .single();

      if (planData?.current_version) {
        const { data: version } = await supabaseAdmin
          .from("plan_versions")
          .select("id")
          .eq("plan_id", planId)
          .eq("version_number", planData.current_version)
          .single();
        if (version) planVersionId = version.id;
      }
    }

    await supabaseAdmin.from("org_subscriptions").insert({
      org_id: org.id,
      plan_id: planId || null,
      plan_version_id: planVersionId,
      billing_type: planId ? "plan" : "custom",
      custom_rate_monthly: planId ? null : 0,
      custom_notes: planId ? null : "Free 14-day trial",
      billing_cycle: "monthly",
      status: "trial",
      trial_ends_at: trialEnd.toISOString(),
      current_period_start: new Date().toISOString(),
      current_period_end: trialEnd.toISOString(),
    });

    // 9. Create referral record if a valid referrer was found
    if (referrerOrgId) {
      await supabaseAdmin.from("referrals").insert({
        referrer_org_id: referrerOrgId,
        referred_org_id: org.id,
        referral_code: referralCode.trim().toUpperCase(),
        credit_rate: 0.10,
        status: "active",
      });
    }

    return NextResponse.json({
      success: true,
      user: { id: authData.user.id, email },
      org: { id: org.id, name: orgName },
    });
  } catch (err: any) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: err?.message || String(err) || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
