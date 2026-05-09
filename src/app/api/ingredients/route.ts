import { z } from "zod";
import { makeCrudRoutes } from "@/lib/api-crud";

const Create = z.object({
  name: z.string().min(1),
  unit: z.string().optional(),
  description: z.string().nullable().optional(),
  allergens: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
});

const handlers = makeCrudRoutes({
  table: "ingredients",
  permissions: {
    view: "ingredients.view",
    create: "ingredients.create",
    edit: "ingredients.edit",
    delete: "ingredients.delete",
  },
  schemas: { create: Create, update: Create.partial() },
  searchableFields: ["name", "description"],
  filterableFields: ["is_active"],
  defaultSort: "name",
});

export const GET = handlers.list;
export const POST = handlers.create;
