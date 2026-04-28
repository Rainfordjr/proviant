import { z } from "zod";
import { makeCrudRoutes } from "@/lib/api-crud";
import { uuid } from "@/lib/validation";

const STATUSES = [
  "planned",
  "in_progress",
  "completed",
  "on_hold",
  "rejected",
] as const;

const Update = z
  .object({
    product_id: uuid(),
    batch_number: z.string().min(1),
    status: z.enum(STATUSES),
    quantity_produced: z.number().nonnegative().nullable(),
    produced_at: z.string().datetime().nullable(),
    notes: z.string().nullable(),
  })
  .partial();

const handlers = makeCrudRoutes({
  table: "batches",
  permissions: {
    view: "batches.view",
    create: "batches.create",
    edit: "batches.edit",
    delete: "batches.delete",
  },
  schemas: { create: Update, update: Update },
});

export const GET = handlers.get;
export const PATCH = handlers.update;
export const DELETE = handlers.remove;
