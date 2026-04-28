import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireApiAuth } from "@/lib/api-auth";
import { parseBody, uuid } from "@/lib/validation";
import { makeCrudRoutes } from "@/lib/api-crud";
import { withIdempotency } from "@/lib/idempotency";

function createAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const ItemSchema = z.object({
  product_id: uuid(),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative().optional(),
  batch_id: uuid().nullable().optional(),
});

const CreateOrderSchema = z.object({
  order_number: z.string().min(1),
  customer_id: uuid().nullable().optional(),
  customer_name: z.string().min(1),
  customer_email: z.string().email().nullable().optional(),
  status: z
    .enum([
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ])
    .optional(),
  notes: z.string().nullable().optional(),
  ordered_at: z.string().datetime().nullable().optional(),
  items: z.array(ItemSchema).min(1),
});

// We use the CRUD helper for the LIST handler (orders.view), but POST is
// custom because creating an order is a multi-row transaction handled by
// the create_order_with_items() SQL function.
const handlers = makeCrudRoutes({
  table: "orders",
  permissions: {
    view: "orders.view",
    create: "orders.create",
    edit: "orders.edit",
    delete: "orders.delete",
  },
  schemas: { create: CreateOrderSchema, update: CreateOrderSchema },
  searchableFields: ["order_number", "customer_name"],
  filterableFields: ["status", "customer_id"],
  defaultSort: "ordered_at",
});

export const GET = handlers.list;

/**
 * POST /api/orders
 *
 * Atomic create: header + line items in one transaction via the
 * create_order_with_items() SQL function. Wrapped in idempotency
 * so a network retry doesn't create two orders.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, "orders.create");
  if (!auth.ok) return auth.response;

  const parsed = await parseBody(request, CreateOrderSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  // If a customer_id is supplied, verify it belongs to this org.
  const admin = createAdmin();
  if (body.customer_id) {
    const { data: customer } = await admin
      .from("customers")
      .select("id, org_id")
      .eq("id", body.customer_id)
      .maybeSingle();
    if (!customer || customer.org_id !== auth.org_id) {
      return NextResponse.json(
        { error: "Customer not found in your organization" },
        { status: 404 }
      );
    }
  }

  const idem = await withIdempotency(request, "create_order", {
    orgId: auth.org_id,
    userId: auth.kind === "user" ? auth.user.id : null,
  });
  if (!idem.ok) return idem.response;
  if (idem.cached) return idem.response;
  const { finish } = idem;

  const { data: result, error } = await admin.rpc("create_order_with_items", {
    p_org_id: auth.org_id,
    p_order_number: body.order_number,
    p_customer_id: body.customer_id ?? null,
    p_customer_name: body.customer_name,
    p_customer_email: body.customer_email ?? null,
    p_status: body.status ?? "pending",
    p_notes: body.notes ?? null,
    p_ordered_at: body.ordered_at ?? null,
    p_items: body.items,
  });

  if (error) {
    return finish(400, { error: error.message });
  }

  const orderId = (result as { order_id?: string } | null)?.order_id;

  // Fetch the created order to return the full row.
  if (orderId) {
    const { data: order } = await admin
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .single();
    return finish(201, { data: order });
  }

  return finish(201, { data: { id: orderId } });
}
