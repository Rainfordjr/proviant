import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { makeCrudRoutes } from "@/lib/api-crud";
import { performedBy } from "@/lib/api-auth";

const Create = z.object({
  type: z.enum(["temperature", "sanitation", "allergen", "ccp", "other"]),
  ccp_id: z.string().nullable().optional(),
  value: z.string().min(1),
  notes: z.string().nullable().optional(),
});

const handlers = makeCrudRoutes({
  table: "compliance_logs",
  permissions: {
    view: "compliance.view",
    create: "compliance.create",
    edit: "compliance.edit",
    // No delete permission seeded for compliance; reuse edit (audit-friendly).
    delete: "compliance.edit",
  },
  schemas: { create: Create, update: Create.partial() },
  searchableFields: ["value", "ccp_id", "notes"],
  filterableFields: ["type"],
  beforeCreate: (_body, ctx) => {
    const recorded_by = performedBy(ctx);
    if (!recorded_by) {
      // compliance_logs.recorded_by is NOT NULL, so we can't accept the
      // write from an API key without a user attribution. Fall back to
      // the api_key's creator if needed (handled in the wrapper below).
    }
    return { recorded_by };
  },
});

const list = handlers.list;
const create = handlers.create;

/** Wrap create to reject API-key auth that has no user attribution. */
async function POST(request: NextRequest) {
  // The CRUD helper handles permission checks; we just need to make sure
  // a recorded_by is present. The helper passes recorded_by=null for
  // API-key auth, which would violate the NOT NULL constraint and surface
  // as a 400 from Postgres. Return a clearer 400 up front instead.
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    return NextResponse.json(
      {
        error:
          "Compliance logs require a user attribution (recorded_by). Authenticate as a user (Bearer JWT or session cookie) for this endpoint.",
      },
      { status: 400 }
    );
  }
  return create(request);
}

export { list as GET, POST };
