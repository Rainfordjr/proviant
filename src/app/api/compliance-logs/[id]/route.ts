import { z } from "zod";
import { makeCrudRoutes } from "@/lib/api-crud";

const Update = z
  .object({
    type: z.enum(["temperature", "sanitation", "allergen", "ccp", "other"]),
    ccp_id: z.string().nullable(),
    value: z.string().min(1),
    notes: z.string().nullable(),
  })
  .partial();

const handlers = makeCrudRoutes({
  table: "compliance_logs",
  permissions: {
    view: "compliance.view",
    create: "compliance.create",
    edit: "compliance.edit",
    delete: "compliance.edit",
  },
  schemas: { create: Update, update: Update },
});

export const GET = handlers.get;
export const PATCH = handlers.update;
export const DELETE = handlers.remove;
