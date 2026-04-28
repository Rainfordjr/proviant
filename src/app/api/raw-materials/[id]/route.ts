import { z } from "zod";
import { makeCrudRoutes } from "@/lib/api-crud";
import { uuid } from "@/lib/validation";

const Update = z
  .object({
    name: z.string().min(1),
    supplier_id: uuid().nullable(),
    unit: z.string(),
    reorder_point: z.number().nonnegative(),
    current_stock: z.number().nonnegative(),
    description: z.string().nullable(),
    is_active: z.boolean(),
  })
  .partial();

const handlers = makeCrudRoutes({
  table: "raw_materials",
  permissions: {
    view: "materials.view",
    create: "materials.create",
    edit: "materials.edit",
    delete: "materials.delete",
  },
  schemas: { create: Update, update: Update },
});

export const GET = handlers.get;
export const PATCH = handlers.update;
export const DELETE = handlers.remove;
