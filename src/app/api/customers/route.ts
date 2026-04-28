import { z } from "zod";
import { makeCrudRoutes } from "@/lib/api-crud";

const Create = z.object({
  name: z.string().min(1),
  contact_name: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

const handlers = makeCrudRoutes({
  table: "customers",
  permissions: {
    view: "customers.view",
    create: "customers.create",
    edit: "customers.edit",
    delete: "customers.delete",
  },
  schemas: { create: Create, update: Create.partial() },
  searchableFields: ["name", "contact_name", "email"],
  filterableFields: ["is_active"],
});

export const GET = handlers.list;
export const POST = handlers.create;
