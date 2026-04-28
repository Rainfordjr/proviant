import { z } from "zod";
import { makeCrudRoutes } from "@/lib/api-crud";

const Create = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  yield_quantity: z.number().nonnegative().optional(),
  yield_unit: z.string().optional(),
  is_active: z.boolean().optional(),
});

const handlers = makeCrudRoutes({
  table: "recipes",
  permissions: {
    view: "recipes.view",
    create: "recipes.create",
    edit: "recipes.edit",
    delete: "recipes.delete",
  },
  schemas: { create: Create, update: Create.partial() },
  searchableFields: ["name", "description"],
  filterableFields: ["is_active"],
});

export const GET = handlers.list;
export const POST = handlers.create;
