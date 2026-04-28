import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/**
 * Permissive UUID validator — accepts any 8-4-4-4-12 hex string.
 *
 * Use instead of z.string().uuid() because Zod 4's .uuid() enforces strict
 * RFC 4122 (version digit 1-8, variant digit 8-b), which rejects the "test"
 * UUIDs in our seed data (e.g. 11000000-0000-0000-0000-000000000001).
 * Postgres uuid columns accept any 36-char hex form, so the strict check
 * is too restrictive for our domain.
 */
export const uuid = () =>
  z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      "Invalid UUID format"
    );

/**
 * Result of parseBody — discriminated so callers can short-circuit on failure.
 */
export type ParseBodyResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

/**
 * Parse a JSON request body against a Zod schema.
 *
 * - On invalid JSON: returns a 400 with `{ error: "Invalid JSON body" }`.
 * - On schema mismatch: returns a 400 with `{ error, issues: [{ path, message }] }`.
 * - On success: returns the typed parsed body.
 *
 * Usage:
 * ```ts
 * const parsed = await parseBody(request, MySchema);
 * if (!parsed.ok) return parsed.response;
 * const { foo } = parsed.data;
 * ```
 */
export async function parseBody<S extends z.ZodType>(
  request: NextRequest,
  schema: S
): Promise<ParseBodyResult<z.infer<S>>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      ),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Invalid request body",
          issues: result.error.issues.map((i) => ({
            path: i.path.map(String).join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: result.data };
}
