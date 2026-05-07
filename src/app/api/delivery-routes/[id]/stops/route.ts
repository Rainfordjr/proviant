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

const AddStop = z.object({
  customer_id: z.string().uuid(),
  stop_order: z.number().int().min(0).optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request, "customers.view");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  const { data, error } = await admin()
    .from("delivery_route_stops")
    .select("*, customers(id, name, address, city, state)")
    .eq("route_id", id)
    .eq("org_id", auth.org_id)
    .order("stop_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request, "customers.edit");
  if (!auth.ok) return auth.response;

  const { id: routeId } = await ctx.params;

  // Verify route belongs to this org
  const { data: route } = await admin()
    .from("delivery_routes")
    .select("id")
    .eq("id", routeId)
    .eq("org_id", auth.org_id)
    .maybeSingle();
  if (!route) return NextResponse.json({ error: "Route not found" }, { status: 404 });

  const parsed = await parseBody(request, AddStop);
  if (!parsed.ok) return parsed.response;

  // Default stop_order to end of list
  let stopOrder = parsed.data.stop_order;
  if (stopOrder === undefined) {
    const { count } = await admin()
      .from("delivery_route_stops")
      .select("id", { count: "exact", head: true })
      .eq("route_id", routeId);
    stopOrder = (count ?? 0) + 1;
  }

  const { data, error } = await admin()
    .from("delivery_route_stops")
    .insert({
      route_id: routeId,
      org_id: auth.org_id,
      customer_id: parsed.data.customer_id,
      stop_order: stopOrder,
      notes: parsed.data.notes ?? null,
    })
    .select("*, customers(id, name, address, city, state)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}
