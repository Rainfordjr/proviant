import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireApiAuth } from "@/lib/api-auth";

function admin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ code: string }> }
) {
  const auth = await requireApiAuth(request, "materials.view");
  if (!auth.ok) return auth.response;

  const { code } = await ctx.params;
  const barcode = decodeURIComponent(code).trim();
  if (!barcode) {
    return NextResponse.json({ error: "Barcode required" }, { status: 400 });
  }

  const { data, error } = await admin()
    .from("material_lots")
    .select(
      "id, lot_number, barcode, quantity, quantity_remaining, expiry_date, received_at, material_id, raw_materials(id, name, unit, ingredient_id, ingredients(id, name, unit))"
    )
    .eq("org_id", auth.org_id)
    .eq("barcode", barcode)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "No lot found for that barcode" }, { status: 404 });
  }

  return NextResponse.json({ data });
}
