import { z } from "zod";
import { makeCrudRoutes } from "@/lib/api-crud";

const Update = z
  .object({
    name: z.string().min(1),
    description: z.string().nullable(),
    is_active: z.boolean(),
    sort_order: z.number().int(),
  })
  .partial();

const handlers = makeCrudRoutes({
  table: "production_lines",
  permissions: {
    view: "production_lines.view",
    create: "production_lines.create",
    edit: "production_lines.edit",
    delete: "production_lines.delete",
  },
  schemas: { create: Update, update: Update },
});

export const GET = handlers.get;
export const PATCH = handlers.update;
export const DELETE = handlers.remove;
