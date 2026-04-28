import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireApiAuth } from "@/lib/api-auth";
import { parseBody } from "@/lib/validation";

function createAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type Status =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

/**
 * Legal forward transitions per current status. The 'cancel' exit is
 * allowed from any non-terminal state. delivered + cancelled are terminal.
 *
 * Mirrors the rules enforced by the OrderStatusActions UI component.
 */
const NEXT_BY_STATUS: Record<Status, Status[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

const Body = z.object({
  status: z.enum([
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ]),
});

/**
 * POST /api/orders/[id]/transition-status
 *
 * Move an order through its workflow. The transition map above is enforced
 * server-side, so a script can't (e.g.) jump straight from pending to
 * delivered and skip the auto-invoice that fires on 'confirmed'.
 *
 * Side effects:
 *   - Sets shipped_at = now() when transitioning to 'shipped'.
 *   - The auto-invoice trigger on the orders table fires when status
 *     changes to 'confirmed' (assuming a customer is linked).
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const auth = await requireApiAuth(request, "orders.edit");
  if (!auth.ok) return auth.response;

  const parsed = await parseBody(request, Body);
  if (!parsed.ok) return parsed.response;
  const target = parsed.data.status;

  const admin = createAdmin();

  const { data: order } = await admin
    .from("orders")
    .select("id, org_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!order || order.org_id !== auth.org_id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const current = order.status as Status;

  // No-op: already in the target state.
  if (current === target) {
    return NextResponse.json({ data: order, unchanged: true });
  }

  const allowed = NEXT_BY_STATUS[current] ?? [];
  if (!allowed.includes(target)) {
    return NextResponse.json(
      {
        error: `Cannot transition from "${current}" to "${target}".`,
        allowed_transitions: allowed,
      },
      { status: 422 }
    );
  }

  const update: { status: Status; shipped_at?: string } = { status: target };
  if (target === "shipped") {
    update.shipped_at = new Date().toISOString();
  }

  const { data: updated, error } = await admin
    .from("orders")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: updated });
}
