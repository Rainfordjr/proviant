import { z } from "zod";
import { makeCrudRoutes } from "@/lib/api-crud";

const Create = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

const handlers = makeCrudRoutes({
  table: "production_lines",
  permissions: {
    view: "production_lines.view",
    create: "production_lines.create",
    edit: "production_lines.edit",
    delete: "production_lines.delete",
  },
  schemas: { create: Create, update: Create.partial() },
  searchableFields: ["name", "description"],
  filterableFields: ["is_active"],
  defaultSort: "sort_order",
});

export const GET = handlers.list;
export const POST = handlers.create;
