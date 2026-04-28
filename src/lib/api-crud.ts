import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import {
  createClient as createServiceClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { requireApiAuth, type ApiAuthContext } from "@/lib/api-auth";
import { parseBody } from "@/lib/validation";

/**
 * Standard REST handler factory for org-scoped tables.
 *
 * Generates list / get / create / update / delete handlers that all
 * follow the same conventions:
 *
 *   - Always tenant-scoped: every query is filtered by `org_id = caller's org`,
 *     regardless of auth method.
 *   - Permission-gated via requireApiAuth.
 *   - Body shapes validated via the supplied Zod schemas.
 *   - List endpoint supports ?limit=, ?offset=, ?sort=, ?order=, ?q=
 *     (against searchableFields), and exact-match ?<field>= for any
 *     filterableField.
 *
 * Each entity gets a thin route file like:
 *
 *   const handlers = makeCrudRoutes({
 *     table: "customers",
 *     permissions: { view: "customers.view", create: "customers.create", ... },
 *     schemas: { create: ..., update: ... },
 *     searchableFields: ["name", "email"],
 *     filterableFields: ["is_active"],
 *   });
 *
 *   export const GET = handlers.list;
 *   export const POST = handlers.create;
 */

function admin(): SupabaseClient {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface CrudOptions<C extends z.ZodType, U extends z.ZodType> {
  /** Postgres table name. */
  table: string;
  /** Permission code per operation. */
  permissions: {
    view: string;
    create: string;
    edit: string;
    delete: string;
  };
  /** Zod schemas for create + update bodies. */
  schemas: {
    create: C;
    update: U;
  };
  /** Columns to include in the response (defaults to "*"). */
  selectColumns?: string;
  /** Default ordering column, e.g. "created_at". */
  defaultSort?: string;
  /** Text columns hit by ?q= via case-insensitive partial match. */
  searchableFields?: string[];
  /** Whitelisted exact-match query parameters (e.g. ?is_active=true). */
  filterableFields?: string[];
  /** Hook to mutate the row before insert (e.g. inject org_id, defaults). */
  beforeCreate?: (
    body: z.infer<C>,
    ctx: ApiAuthContext
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;
  /** Hook to mutate the patch payload before update. */
  beforeUpdate?: (
    body: z.infer<U>,
    ctx: ApiAuthContext
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;
}

export function makeCrudRoutes<C extends z.ZodType, U extends z.ZodType>(
  opts: CrudOptions<C, U>
) {
  const select = opts.selectColumns ?? "*";
  const defaultSort = opts.defaultSort ?? "created_at";

  /** GET /api/<resource>?... — list rows in the caller's org. */
  async function list(request: NextRequest) {
    const auth = await requireApiAuth(request, opts.permissions.view);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") ?? "100", 10) || 100, 1),
      500
    );
    const offset = Math.max(
      parseInt(url.searchParams.get("offset") ?? "0", 10) || 0,
      0
    );
    const sort = url.searchParams.get("sort") ?? defaultSort;
    const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";
    const q = url.searchParams.get("q")?.trim();

    let query = admin()
      .from(opts.table)
      .select(select, { count: "exact" })
      .eq("org_id", auth.org_id)
      .order(sort, { ascending: order === "asc" })
      .range(offset, offset + limit - 1);

    // Whitelisted exact-match filters
    for (const field of opts.filterableFields ?? []) {
      const value = url.searchParams.get(field);
      if (value !== null) {
        // Coerce booleans / numbers from string when obvious
        if (value === "true") query = query.eq(field, true);
        else if (value === "false") query = query.eq(field, false);
        else query = query.eq(field, value);
      }
    }

    // Free-text search over whitelisted text columns
    if (q && opts.searchableFields?.length) {
      const safe = q.replace(/[%_]/g, (ch) => `\\${ch}`);
      const orExpr = opts.searchableFields
        .map((f) => `${f}.ilike.%${safe}%`)
        .join(",");
      query = query.or(orExpr);
    }

    const { data, error, count } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: data ?? [],
      pagination: {
        limit,
        offset,
        total: count ?? null,
      },
    });
  }

  /** POST /api/<resource> — create a row in the caller's org. */
  async function create(request: NextRequest) {
    const auth = await requireApiAuth(request, opts.permissions.create);
    if (!auth.ok) return auth.response;

    const parsed = await parseBody(request, opts.schemas.create);
    if (!parsed.ok) return parsed.response;

    const extra = opts.beforeCreate
      ? await opts.beforeCreate(parsed.data, auth)
      : {};

    // Always inject org_id; the caller can't override it.
    const payload = {
      ...(parsed.data as Record<string, unknown>),
      ...extra,
      org_id: auth.org_id,
    };

    const { data, error } = await admin()
      .from(opts.table)
      .insert(payload)
      .select(select)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ data }, { status: 201 });
  }

  /** GET /api/<resource>/[id] — fetch a single row. */
  async function get(
    request: NextRequest,
    ctx: { params: Promise<{ id: string }> }
  ) {
    const auth = await requireApiAuth(request, opts.permissions.view);
    if (!auth.ok) return auth.response;

    const { id } = await ctx.params;

    const { data, error } = await admin()
      .from(opts.table)
      .select(select)
      .eq("id", id)
      .eq("org_id", auth.org_id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ data });
  }

  /** PATCH /api/<resource>/[id] — partial update. */
  async function update(
    request: NextRequest,
    ctx: { params: Promise<{ id: string }> }
  ) {
    const auth = await requireApiAuth(request, opts.permissions.edit);
    if (!auth.ok) return auth.response;

    const { id } = await ctx.params;

    const parsed = await parseBody(request, opts.schemas.update);
    if (!parsed.ok) return parsed.response;

    const extra = opts.beforeUpdate
      ? await opts.beforeUpdate(parsed.data, auth)
      : {};

    const payload = {
      ...(parsed.data as Record<string, unknown>),
      ...extra,
    };
    // Never let the caller change org_id via update.
    delete payload.org_id;
    delete payload.id;

    const { data, error } = await admin()
      .from(opts.table)
      .update(payload)
      .eq("id", id)
      .eq("org_id", auth.org_id)
      .select(select)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ data });
  }

  /** DELETE /api/<resource>/[id]. */
  async function remove(
    request: NextRequest,
    ctx: { params: Promise<{ id: string }> }
  ) {
    const auth = await requireApiAuth(request, opts.permissions.delete);
    if (!auth.ok) return auth.response;

    const { id } = await ctx.params;

    const { error, count } = await admin()
      .from(opts.table)
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("org_id", auth.org_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!count) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  }

  return { list, create, get, update, remove };
}
