import { z } from "zod";
import { makeCrudRoutes } from "@/lib/api-crud";

const Create = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  category: z.string().optional(),
  unit: z.string().optional(),
  description: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

const handlers = makeCrudRoutes({
  table: "products",
  permissions: {
    view: "products.view",
    create: "products.create",
    edit: "products.edit",
    delete: "products.delete",
  },
  schemas: { create: Create, update: Create.partial() },
  searchableFields: ["name", "sku", "description"],
  filterableFields: ["is_active", "category"],
});

export const GET = handlers.list;
export const POST = handlers.create;
