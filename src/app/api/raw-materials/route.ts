import { z } from "zod";
import { makeCrudRoutes } from "@/lib/api-crud";
import { uuid } from "@/lib/validation";

const Create = z.object({
  name: z.string().min(1),
  supplier_id: uuid().nullable().optional(),
  unit: z.string().optional(),
  reorder_point: z.number().nonnegative().optional(),
  current_stock: z.number().nonnegative().optional(),
  description: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

const handlers = makeCrudRoutes({
  table: "raw_materials",
  permissions: {
    view: "materials.view",
    create: "materials.create",
    edit: "materials.edit",
    delete: "materials.delete",
  },
  schemas: { create: Create, update: Create.partial() },
  searchableFields: ["name", "description"],
  filterableFields: ["is_active", "supplier_id"],
});

export const GET = handlers.list;
export const POST = handlers.create;
