import { z } from "zod";
import { makeCrudRoutes } from "@/lib/api-crud";

const Update = z
  .object({
    name: z.string().min(1),
    description: z.string().nullable(),
    instructions: z.string().nullable(),
    yield_quantity: z.number().nonnegative(),
    yield_unit: z.string(),
    is_active: z.boolean(),
  })
  .partial();

const handlers = makeCrudRoutes({
  table: "recipes",
  permissions: {
    view: "recipes.view",
    create: "recipes.create",
    edit: "recipes.edit",
    delete: "recipes.delete",
  },
  schemas: { create: Update, update: Update },
});

export const GET = handlers.get;
export const PATCH = handlers.update;
export const DELETE = handlers.remove;
