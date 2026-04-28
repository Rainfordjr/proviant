import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/platformAdmin";

/**
 * Idempotency helper for state-changing API routes (financial mutations,
 * particularly). Clients send an `Idempotency-Key` header; this module
 * detects duplicates and short-circuits with the cached response.
 *
 * Storage is the `idempotency_keys` table. The flow is claim-then-update
 * so a concurrent duplicate doesn't run the work twice:
 *
 *   1. INSERT a row with status_code=0 ("in flight"). Primary key is
 *      (scope, key), so a duplicate insert from a concurrent request
 *      fails with 23505. That request reads the existing row instead.
 *   2. Caller does the work.
 *   3. Caller calls `finish(status, body)`, which UPDATEs the row to
 *      the final status/response and returns a NextResponse.
 *
 * If the request has no Idempotency-Key header, no row is written —
 * `finish()` just returns the response. (We don't *require* the header
 * so existing clients keep working; only requests that send the header
 * get dedup protection.)
 */

export type IdempotencyResult =
  /** Cached hit — return `response` immediately, no work needed. */
  | { ok: true; cached: true; response: NextResponse }
  /** Conflict — another request is still processing this key. */
  | { ok: false; response: NextResponse }
  /** First time we've seen this key (or no key supplied). Run the work
   *  then call `finish` to persist the result and produce the response. */
  | {
      ok: true;
      cached: false;
      finish: (status: number, body: unknown) => Promise<NextResponse>;
    };

export async function withIdempotency(
  request: NextRequest,
  scope: string,
  meta: { orgId?: string | null; userId?: string | null }
): Promise<IdempotencyResult> {
  const key = request.headers.get("idempotency-key");

  // No header: pass through. Caller still gets a finish() they can call;
  // it just won't write anything.
  if (!key) {
    return {
      ok: true,
      cached: false,
      finish: async (status, body) => NextResponse.json(body, { status }),
    };
  }

  const admin = createAdminClient();

  // Try to claim the key.
  const { error: insertErr } = await admin.from("idempotency_keys").insert({
    scope,
    key,
    org_id: meta.orgId ?? null,
    user_id: meta.userId ?? null,
    status_code: 0,
    response: null,
  });

  if (insertErr) {
    // 23505 = unique_violation → another request already claimed this key.
    if (insertErr.code === "23505") {
      const { data: existing } = await admin
        .from("idempotency_keys")
        .select("status_code, response")
        .eq("scope", scope)
        .eq("key", key)
        .maybeSingle();

      if (!existing) {
        // Row vanished between insert-fail and re-select. Treat as a 409.
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Idempotency lookup failed; please retry." },
            { status: 409 }
          ),
        };
      }

      if (existing.status_code === 0) {
        // Still in flight on another worker. Tell client to back off.
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Request with this Idempotency-Key is still processing" },
            { status: 409 }
          ),
        };
      }

      return {
        ok: true,
        cached: true,
        response: NextResponse.json(existing.response, {
          status: existing.status_code,
        }),
      };
    }

    // Unexpected DB error claiming the key — fail closed.
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Failed to claim idempotency key: " + insertErr.message },
        { status: 500 }
      ),
    };
  }

  // We won the claim. Caller must call finish() to record the result.
  return {
    ok: true,
    cached: false,
    finish: async (status, body) => {
      await admin
        .from("idempotency_keys")
        .update({
          status_code: status,
          response: body as object,
          completed_at: new Date().toISOString(),
        })
        .eq("scope", scope)
        .eq("key", key);

      return NextResponse.json(body, { status });
    },
  };
}
