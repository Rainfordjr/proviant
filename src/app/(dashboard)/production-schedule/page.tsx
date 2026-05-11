import { requirePermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { ScheduleView } from "@/components/schedule/schedule-view";

export default async function ProductionSchedulePage() {
  await requirePermission("batches.view");

  const supabase = await createClient();

  // Fetch scheduled batches. resource_assignments.resource_id can be either
  // a user_id or an equipment_id (decided by resource_type), so there's no
  // single FK PostgREST can auto-embed. Fetch resource_assignments without a
  // nested embed and resolve equipment by id in JS below.
  const { data: rawBatches, error: batchesErr } = await supabase
    .from("batches")
    .select(
      `*, product:products(*), recipes(*), resource_assignments:schedule_resource_assignments(*), product_allocations:batch_product_allocations(*, product:products(*))`
    )
    .not("scheduled_date", "is", null)
    .order("scheduled_date", { ascending: true });

  if (batchesErr) {
    console.error("production-schedule batches query failed:", batchesErr);
  }

  // Resolve assigned users separately to avoid FK naming issues
  const batches = rawBatches || [];
  const assignedIds = [...new Set(batches.map((b: any) => b.assigned_to).filter(Boolean))];
  let assignedUserMap: Record<string, any> = {};
  if (assignedIds.length > 0) {
    const { data: assignedUsers } = await supabase
      .from("users")
      .select("id, full_name, email, role")
      .in("id", assignedIds);
    for (const u of assignedUsers || []) {
      assignedUserMap[u.id] = u;
    }
  }
  // Hydrate equipment on resource_assignments by id (cheap; the equipment
  // table is small per-org). orgEquipment is fetched later in this function;
  // build a temp map now from a direct query.
  const equipmentIds = new Set<string>();
  for (const b of batches as any[]) {
    for (const ra of (b.resource_assignments ?? []) as any[]) {
      if (ra.resource_type === "equipment" && ra.resource_id) equipmentIds.add(ra.resource_id);
    }
  }
  let equipmentMap: Record<string, any> = {};
  if (equipmentIds.size > 0) {
    const { data: eqRows } = await supabase
      .from("equipment")
      .select("*")
      .in("id", Array.from(equipmentIds));
    for (const e of eqRows || []) equipmentMap[(e as { id: string }).id] = e;
  }

  const batchesWithUsers = batches.map((b: any) => ({
    ...b,
    assigned_user: b.assigned_to ? assignedUserMap[b.assigned_to] || null : null,
    resource_assignments: (b.resource_assignments ?? []).map((ra: any) => ({
      ...ra,
      equipment: ra.resource_type === "equipment" ? equipmentMap[ra.resource_id] ?? null : null,
    })),
  }));

  // Fetch active products
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("name");

  // Fetch active recipes
  const { data: recipes } = await supabase
    .from("recipes")
    .select("*")
    .eq("is_active", true)
    .order("name");

  // Fetch product-recipe relationships for allocation
  const { data: productComponents } = await supabase
    .from("product_components")
    .select("id, product_id, component_type, recipe_id, quantity, unit")
    .eq("component_type", "recipe");

  // Get current user's org for scoped queries
  const { data: authUser } = await supabase.auth.getUser();
  let orgUsers: any[] = [];
  let orgEquipment: any[] = [];

  if (authUser.user) {
    const { data: profile } = await supabase
      .from("users")
      .select("org_id")
      .eq("id", authUser.user.id)
      .single();

    if (profile?.org_id) {
      // Fetch org users for assignment
      const { data: users } = await supabase
        .from("users")
        .select("id, full_name, email, role")
        .eq("org_id", profile.org_id)
        .order("full_name");
      orgUsers = users || [];

      // Fetch available equipment
      const { data: eq } = await supabase
        .from("equipment")
        .select("*")
        .eq("org_id", profile.org_id)
        .eq("is_available", true)
        .order("name");
      orgEquipment = eq || [];
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Production Schedule</h1>
        <p className="text-sm text-gray-500 mt-1">
          Plan, schedule, and track production batches
        </p>
      </div>

      <ScheduleView
        batches={batchesWithUsers}
        products={products || []}
        recipes={recipes || []}
        users={orgUsers}
        equipment={orgEquipment}
        productComponents={(productComponents || []) as import("@/types").ProductComponent[]}
      />
    </div>
  );
}
