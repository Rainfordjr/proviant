import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createClient as createServiceClient,
  type User,
} from "@supabase/supabase-js";
import crypto from "crypto";

/**
 * Unified auth resolution for the public API.
 *
 * A request can authenticate three different ways:
 *
 *   1. Cookie session — what the browser uses today (existing UI keeps
 *      working unchanged).
 *   2. Authorization: Bearer <jwt> — what the headless login route returns;
 *      same identity as a cookie session, just supplied via header.
 *   3. X-API-Key: <key> — a per-org service credential. No human user is
 *      attached; permissions are enforced via the key's `scopes` array.
 *
 * `requireApiAuth(perm)` returns a discriminated result so route handlers
 * can short-circuit cleanly. The result always carries `org_id`; for
 * user-backed auth it also carries `user`. When a route writes a
 * "performed_by" column it should fall back to NULL when the auth came
 * from an API key.
 */

export type ApiAuthContext =
  | {
      ok: true;
      kind: "user";
      user: User;
      org_id: string;
    }
  | {
      ok: true;
      kind: "api_key";
      api_key_id: string;
      org_id: string;
      scopes: string[];
    };

export type ApiAuthResult = ApiAuthContext | { ok: false; response: NextResponse };

function createAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Hash a plaintext API key the same way we hash on creation, so callers
 * can compare. SHA-256 is fine here because API keys carry their own
 * entropy — we're not protecting low-entropy passwords.
 */
export function hashApiKey(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

/**
 * Generate a fresh API key. Returns { plaintext, prefix, hash } — the
 * caller persists prefix+hash and shows plaintext to the operator once.
 *
 * Format: pk_<32 url-safe base64 chars>. The "pk_" prefix is fixed so
 * the operator visually recognises it; the prefix column we store is
 * the first 8 chars of the whole string.
 */
export function generateApiKey(): {
  plaintext: string;
  prefix: string;
  hash: string;
} {
  const random = crypto.randomBytes(24).toString("base64url");
  const plaintext = `pk_${random}`;
  return {
    plaintext,
    prefix: plaintext.slice(0, 8),
    hash: hashApiKey(plaintext),
  };
}

/**
 * Resolve authentication for an incoming API request and check that the
 * caller has the required permission.
 *
 * For user-backed auth the permission is resolved via the existing
 * user_has_permission() SQL function (which handles is_admin bypass).
 * For API-key auth, the key's scopes are checked: a scope of "*" passes
 * everything, otherwise the perm code must be present.
 */
export async function requireApiAuth(
  request: NextRequest,
  perm: string
): Promise<ApiAuthResult> {
  // ── Path 1: API key via X-API-Key header ────────────────────────────
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    if (!apiKey.startsWith("pk_") || apiKey.length < 12) {
      return { ok: false, response: unauthorized("Invalid API key format") };
    }
    const prefix = apiKey.slice(0, 8);
    const hash = hashApiKey(apiKey);

    const admin = createAdmin();
    const { data: row } = await admin
      .from("api_keys")
      .select("id, org_id, key_hash, scopes, revoked_at")
      .eq("key_prefix", prefix)
      .maybeSingle();

    // Constant-time-ish comparison to avoid leaking validity timing.
    const validHash =
      row &&
      row.key_hash &&
      row.key_hash.length === hash.length &&
      crypto.timingSafeEqual(
        Buffer.from(row.key_hash, "hex"),
        Buffer.from(hash, "hex")
      );

    if (!row || !validHash) {
      return { ok: false, response: unauthorized("Invalid API key") };
    }
    if (row.revoked_at) {
      return { ok: false, response: unauthorized("API key has been revoked") };
    }

    const scopes: string[] = row.scopes ?? [];
    const hasScope = scopes.includes("*") || scopes.includes(perm);
    if (!hasScope) {
      return {
        ok: false,
        response: forbidden(`API key missing required scope: ${perm}`),
      };
    }

    // Fire-and-forget last-used update.
    void admin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", row.id);

    return {
      ok: true,
      kind: "api_key",
      api_key_id: row.id,
      org_id: row.org_id,
      scopes,
    };
  }

  // ── Path 2: Bearer JWT (Authorization header) ───────────────────────
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const jwt = authHeader.slice(7).trim();
    // Use a service-role client to validate the JWT — getUser(jwt)
    // returns the user encoded in that JWT without needing cookies.
    const admin = createAdmin();
    const { data: userResult } = await admin.auth.getUser(jwt);
    const user = userResult?.user;
    if (!user) {
      return { ok: false, response: unauthorized("Invalid bearer token") };
    }

    const { data: profile } = await admin
      .from("users")
      .select("org_id")
      .eq("id", user.id)
      .single();
    if (!profile?.org_id) {
      return { ok: false, response: forbidden("User is not part of any organization") };
    }

    // Permission check: user_has_permission RPC. We need an RLS-bound
    // client whose JWT is the user's, so the RPC sees the right user.
    const userClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } }
    );
    const { data: hasPerm } = await userClient.rpc("user_has_permission", {
      perm_code: perm,
    });
    if (hasPerm !== true) {
      return {
        ok: false,
        response: forbidden(`Missing permission: ${perm}`),
      };
    }

    return {
      ok: true,
      kind: "user",
      user,
      org_id: profile.org_id,
    };
  }

  // ── Path 3: Cookie session (existing UI flow) ───────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: unauthorized("Not authenticated") };
  }
  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile?.org_id) {
    return { ok: false, response: forbidden("User is not part of any organization") };
  }
  const { data: hasPerm } = await supabase.rpc("user_has_permission", {
    perm_code: perm,
  });
  if (hasPerm !== true) {
    return {
      ok: false,
      response: forbidden(`Missing permission: ${perm}`),
    };
  }
  return {
    ok: true,
    kind: "user",
    user,
    org_id: profile.org_id,
  };
}

/**
 * Convenience: extract a user_id for "performed_by" columns. Returns
 * the auth'd user's id when the request is user-backed, else null.
 */
export function performedBy(ctx: ApiAuthContext): string | null {
  return ctx.kind === "user" ? ctx.user.id : null;
}
