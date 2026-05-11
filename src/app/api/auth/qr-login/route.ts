import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { parseBody } from "@/lib/validation";

const Body = z.object({
  redirect: z.string().min(1).startsWith("/"),
});

// Perms the auto-provisioned operator role needs to run the production
// satellite (pick a line, see the queue, consume materials, mark complete).
// Nothing else — explicitly NOT settings/customers/billing/etc.
const OPERATOR_PERMS = [
  "batches.view",
  "batches.edit",
  "production_lines.view",
  "materials.view",
  "ingredients.view",
  "recipes.view",
  "inventory.view",
];

const OPERATOR_EMAIL_PREFIX = "production-operator+";
const OPERATOR_EMAIL_DOMAIN = "proviant.local";
const OPERATOR_ROLE_NAME = "Production Operator";

function admin(): SupabaseClient {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  // Caller must be authenticated via cookie session.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile?.org_id) {
    return NextResponse.json({ error: "No org" }, { status: 403 });
  }

  const parsed = await parseBody(request, Body);
  if (!parsed.ok) return parsed.response;

  const adminClient = admin();
  const operator = await ensureProductionOperator(adminClient, profile.org_id);
  if (!operator.ok) {
    return NextResponse.json({ error: operator.error }, { status: 500 });
  }

  const origin = request.nextUrl.origin;
  // Always route magic links through /auth/callback so the PKCE code is
  // exchanged server-side and the session lands in cookies (otherwise RLS
  // sees no user and the app renders empty). The page the operator should
  // land on after the exchange is passed as ?next=.
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(parsed.data.redirect)}`;

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email: operator.email,
    options: { redirectTo },
  });

  if (error || !data?.properties?.action_link) {
    return NextResponse.json(
      { error: error?.message || "Could not generate sign-in link" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    url: data.properties.action_link,
    redirect: redirectTo,
    email: operator.email,
    role: OPERATOR_ROLE_NAME,
  });
}

/**
 * Idempotently provision a single "Production Operator" user + role per org.
 * Each org gets one such operator identity that the production satellite QR
 * signs in as. The user has only the perms in OPERATOR_PERMS — no settings
 * access, no customer/billing access.
 */
async function ensureProductionOperator(
  client: SupabaseClient,
  orgId: string
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const shortOrg = orgId.replace(/-/g, "").slice(0, 12);
  const email = `${OPERATOR_EMAIL_PREFIX}${shortOrg}@${OPERATOR_EMAIL_DOMAIN}`;

  // 1. auth.users — find or create
  let authUserId: string | null = null;
  {
    const { data: list } = await client.auth.admin.listUsers({ perPage: 200 });
    const match = list?.users?.find((u) => u.email === email);
    if (match) {
      authUserId = match.id;
    } else {
      const { data: created, error } = await client.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { production_operator: true, org_id: orgId },
      });
      if (error || !created?.user) {
        return { ok: false, error: error?.message || "create auth user failed" };
      }
      authUserId = created.user.id;
    }
  }
  if (!authUserId) return { ok: false, error: "no auth user id" };

  // 2. public.users — find or create the profile row in this org
  {
    const { data: existing } = await client
      .from("users")
      .select("id, org_id")
      .eq("id", authUserId)
      .maybeSingle();
    if (!existing) {
      const { error } = await client.from("users").insert({
        id: authUserId,
        org_id: orgId,
        email,
        full_name: "Production Operator",
        role: "operator",
      });
      if (error) return { ok: false, error: `profile: ${error.message}` };
    } else if (existing.org_id !== orgId) {
      return { ok: false, error: "operator user already belongs to a different org" };
    }
  }

  // 3. Production Operator role for this org — find or create
  let roleId: string | null = null;
  {
    const { data: role } = await client
      .from("roles")
      .select("id")
      .eq("org_id", orgId)
      .eq("name", OPERATOR_ROLE_NAME)
      .maybeSingle();
    if (role) {
      roleId = role.id;
    } else {
      const { data: created, error } = await client
        .from("roles")
        .insert({
          org_id: orgId,
          name: OPERATOR_ROLE_NAME,
          description:
            "Auto-provisioned role for the Production satellite app. Limited to what the floor app needs.",
          is_system: true,
          is_admin: false,
          mode: "whitelist",
        })
        .select("id")
        .single();
      if (error || !created) return { ok: false, error: `role: ${error?.message}` };
      roleId = created.id;
    }
  }

  // 4. Grant the operator perms to the role (idempotent — insert any missing)
  if (roleId) {
    const { data: perms } = await client
      .from("permissions")
      .select("id, code")
      .in("code", OPERATOR_PERMS);
    if (perms && perms.length > 0) {
      const { data: existingGrants } = await client
        .from("role_permissions")
        .select("permission_id")
        .eq("role_id", roleId);
      const have = new Set((existingGrants ?? []).map((g) => g.permission_id));
      const toInsert = perms
        .filter((p) => !have.has(p.id))
        .map((p) => ({ role_id: roleId!, permission_id: p.id }));
      if (toInsert.length > 0) {
        await client.from("role_permissions").insert(toInsert);
      }
    }
  }

  // 5. Assign role to operator user
  if (roleId) {
    const { data: link } = await client
      .from("user_roles")
      .select("id")
      .eq("user_id", authUserId)
      .eq("role_id", roleId)
      .maybeSingle();
    if (!link) {
      await client.from("user_roles").insert({ user_id: authUserId, role_id: roleId });
    }
  }

  return { ok: true, email };
}
