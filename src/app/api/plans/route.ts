import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Public endpoint — no auth required. Uses service role to bypass RLS.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data: plans, error } = await supabase
    .from("plans")
    .select("id, name, description, price_monthly, price_yearly, max_users, max_batches_per_month, included_modules, is_featured, badge, sort_order")
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ plans });
}
