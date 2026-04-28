import { z } from "zod";
import { makeCrudRoutes } from "@/lib/api-crud";

const Update = z
  .object({
    name: z.string().min(1),
    contact_name: z.string().nullable(),
    email: z.string().email().nullable(),
    phone: z.string().nullable(),
    address: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    zip: z.string().nullable(),
    notes: z.string().nullable(),
    is_active: z.boolean(),
  })
  .partial();

const handlers = makeCrudRoutes({
  table: "customers",
  permissions: {
    view: "customers.view",
    create: "customers.create",
    edit: "customers.edit",
    delete: "customers.delete",
  },
  schemas: { create: Update, update: Update },
});

export const GET = handlers.get;
export const PATCH = handlers.update;
export const DELETE = handlers.remove;
