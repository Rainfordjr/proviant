import { z } from "zod";
import { makeCrudRoutes } from "@/lib/api-crud";

const Update = z
  .object({
    name: z.string().min(1),
    unit: z.string(),
    description: z.string().nullable(),
    allergens: z.array(z.string()),
    is_active: z.boolean(),
  })
  .partial();

const handlers = makeCrudRoutes({
  table: "ingredients",
  permissions: {
    view: "ingredients.view",
    create: "ingredients.create",
    edit: "ingredients.edit",
    delete: "ingredients.delete",
  },
  schemas: { create: Update, update: Update },
});

export const GET = handlers.get;
export const PATCH = handlers.update;
export const DELETE = handlers.remove;
