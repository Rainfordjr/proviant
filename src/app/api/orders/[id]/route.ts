import { z } from "zod";
import { makeCrudRoutes } from "@/lib/api-crud";
import { uuid } from "@/lib/validation";

const Update = z
  .object({
    order_number: z.string().min(1),
    customer_id: uuid().nullable(),
    customer_name: z.string().min(1),
    customer_email: z.string().email().nullable(),
    notes: z.string().nullable(),
    // Status is updated via /api/orders/[id]/transition-status to enforce
    // the legal-transition rules and trigger side effects (auto-invoice).
  })
  .partial();

const handlers = makeCrudRoutes({
  table: "orders",
  permissions: {
    view: "orders.view",
    create: "orders.create",
    edit: "orders.edit",
    delete: "orders.delete",
  },
  schemas: { create: Update, update: Update },
  selectColumns: "*, order_items(*)",
});

export const GET = handlers.get;
export const PATCH = handlers.update;
export const DELETE = handlers.remove;
