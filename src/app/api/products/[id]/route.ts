import { z } from "zod";
import { makeCrudRoutes } from "@/lib/api-crud";

const Update = z
  .object({
    name: z.string().min(1),
    sku: z.string().min(1),
    category: z.string(),
    unit: z.string(),
    description: z.string().nullable(),
    is_active: z.boolean(),
  })
  .partial();

const handlers = makeCrudRoutes({
  table: "products",
  permissions: {
    view: "products.view",
    create: "products.create",
    edit: "products.edit",
    delete: "products.delete",
  },
  schemas: { create: Update, update: Update },
});

export const GET = handlers.get;
export const PATCH = handlers.update;
export const DELETE = handlers.remove;
