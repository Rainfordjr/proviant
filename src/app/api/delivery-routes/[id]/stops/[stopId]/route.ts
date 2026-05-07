import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireApiAuth } from "@/lib/api-auth";
import { parseBody } from "@/lib/validation";

function admin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const UpdateStop = z.object({
  stop_order: z.number().int().min(0).optional(),
  notes: z.string().nullable().optional(),
}).partial();

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; stopId: string }> }
) {
  const auth = await requireApiAuth(request, "customers.edit");
  if (!auth.ok) return auth.response;

  const { stopId } = await ctx.params;

  const parsed = await parseBody(request, UpdateStop);
  if (!parsed.ok) return parsed.response;

  const { data, error } = await admin()
    .from("delivery_route_stops")
    .update(parsed.data)
    .eq("id", stopId)
    .eq("org_id", auth.org_id)
    .select("*, customers(id, name, address, city, state)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; stopId: string }> }
) {
  const auth = await requireApiAuth(request, "customers.edit");
  if (!auth.ok) return auth.response;

  const { stopId } = await ctx.params;

  const { error, count } = await admin()
    .from("delivery_route_stops")
    .delete({ count: "exact" })
    .eq("id", stopId)
    .eq("org_id", auth.org_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
