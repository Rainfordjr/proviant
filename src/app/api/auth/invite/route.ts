import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Admin client to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Verify the requesting user is authenticated and get their org
    const supabase = await createServerClient();
    const {
      data: { user: currentAuthUser },
    } = await supabase.auth.getUser();

    if (!currentAuthUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify the user has an admin role
    const { data: adminCheck } = await supabase
      .from("user_roles")
      .select("roles!inner(is_admin)")
      .eq("user_id", currentAuthUser.id)
      .eq("roles.is_admin", true)
      .limit(1);

    if (!adminCheck || adminCheck.length === 0) {
      return NextResponse.json(
        { error: "Only administrators can invite users" },
        { status: 403 }
      );
    }

    // Get the inviter's org_id from their profile
    const { data: inviter } = await supabase
      .from("users")
      .select("org_id")
      .eq("id", currentAuthUser.id)
      .single();

    if (!inviter) {
      return NextResponse.json(
        { error: "Could not find your user profile" },
        { status: 400 }
      );
    }

    const { email, fullName, roleId } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // 1. Create the auth user with an invite (auto-confirm for local dev)
    //    In production, you'd use inviteUserByEmail() which sends a magic link.
    //    For local dev we create with a temporary password they'll change.
    const tempPassword =
      "Temp" +
      Math.random().toString(36).slice(2) +
      Math.random().toString(36).slice(2) +
      "!1";

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName || email.split("@")[0],
          invited_by: currentAuthUser.id,
        },
      });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // 2. Create the user profile in the same org as the inviter
    const { error: profileError } = await supabaseAdmin.from("users").insert({
      id: authData.user.id,
      org_id: inviter.org_id,
      email: email,
      full_name: fullName || email.split("@")[0],
      role: "operator", // Legacy role field — actual access controlled by RBAC roles
    });

    if (profileError) {
      // Clean up auth user on failure
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: "Failed to create user profile: " + profileError.message },
        { status: 500 }
      );
    }

    // 3. Assign role if one was selected
    if (roleId) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: authData.user.id,
          role_id: roleId,
        });

      if (roleError) {
        // Non-fatal — user is created, role can be assigned later
        console.error("Failed to assign role:", roleError.message);
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email,
        fullName: fullName || email.split("@")[0],
      },
      tempPassword, // Return so admin can share with the new user
    });
  } catch (err) {
    console.error("Invite error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
