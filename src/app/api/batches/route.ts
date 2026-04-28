import { z } from "zod";
import { makeCrudRoutes } from "@/lib/api-crud";
import { performedBy } from "@/lib/api-auth";
import { uuid } from "@/lib/validation";

const STATUSES = [
  "planned",
  "in_progress",
  "completed",
  "on_hold",
  "rejected",
] as const;

const Create = z.object({
  product_id: uuid(),
  batch_number: z.string().min(1),
  status: z.enum(STATUSES).optional(),
  quantity_produced: z.number().nonnegative().nullable().optional(),
  produced_at: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const handlers = makeCrudRoutes({
  table: "batches",
  permissions: {
    view: "batches.view",
    create: "batches.create",
    edit: "batches.edit",
    delete: "batches.delete",
  },
  schemas: { create: Create, update: Create.partial() },
  searchableFields: ["batch_number", "notes"],
  filterableFields: ["status", "product_id"],
  beforeCreate: (_body, ctx) => ({ created_by: performedBy(ctx) }),
});

export const GET = handlers.list;
export const POST = handlers.create;
