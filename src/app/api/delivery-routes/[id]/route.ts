import { z } from "zod";
import { makeCrudRoutes } from "@/lib/api-crud";

const Schema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  day_of_week: z.string().nullable().optional(),
  driver_name: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
}).partial();

const handlers = makeCrudRoutes({
  table: "delivery_routes",
  permissions: {
    view: "customers.view",
    create: "customers.edit",
    edit: "customers.edit",
    delete: "customers.edit",
  },
  schemas: { create: Schema, update: Schema },
});

export const GET = handlers.get;
export const PATCH = handlers.update;
export const DELETE = handlers.remove;
