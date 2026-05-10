import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireApiAuth } from "@/lib/api-auth";
import { parseBody, uuid } from "@/lib/validation";

function admin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const Body = z.object({
  ingredient_id: uuid(),
  material_lot_id: uuid(),
  quantity_used: z.number().positive(),
});

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request, "batches.edit");
  if (!auth.ok) return auth.response;

  const { id: batch_id } = await ctx.params;
  const parsed = await parseBody(request, Body);
  if (!parsed.ok) return parsed.response;
  const { ingredient_id, material_lot_id, quantity_used } = parsed.data;

  const db = admin();

  // 1. Confirm batch exists in caller's org and resolve recipe
  const { data: batch, error: batchErr } = await db
    .from("batches")
    .select("id, org_id, recipe_id, recipe_version_id, recipes(id, name, current_version_id)")
    .eq("id", batch_id)
    .eq("org_id", auth.org_id)
    .maybeSingle();
  if (batchErr) return NextResponse.json({ error: batchErr.message }, { status: 500 });
  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  const recipe = (batch as unknown as { recipes: { id: string; name: string; current_version_id: string | null } | null }).recipes;
  const versionId = batch.recipe_version_id ?? recipe?.current_version_id ?? null;
  if (!versionId || !recipe) {
    return NextResponse.json(
      { error: "Batch has no resolvable recipe version" },
      { status: 422 }
    );
  }

  // 2. Confirm ingredient is part of the recipe version
  const { data: rvi, error: rviErr } = await db
    .from("recipe_version_ingredients")
    .select("id, ingredient_id, ingredients(name)")
    .eq("recipe_version_id", versionId)
    .eq("ingredient_id", ingredient_id)
    .maybeSingle();
  if (rviErr) return NextResponse.json({ error: rviErr.message }, { status: 500 });
  if (!rvi) {
    return NextResponse.json(
      { error: "That ingredient isn't called for in this recipe version" },
      { status: 422 }
    );
  }

  // 3. Resolve lot + material; verify org, ingredient match
  const { data: lot, error: lotErr } = await db
    .from("material_lots")
    .select(
      "id, org_id, material_id, lot_number, quantity_remaining, raw_materials(id, name, ingredient_id)"
    )
    .eq("id", material_lot_id)
    .eq("org_id", auth.org_id)
    .maybeSingle();
  if (lotErr) return NextResponse.json({ error: lotErr.message }, { status: 500 });
  if (!lot) return NextResponse.json({ error: "Lot not found" }, { status: 404 });

  const material = (lot as unknown as { raw_materials: { id: string; name: string; ingredient_id: string } | null }).raw_materials;
  if (!material) {
    return NextResponse.json({ error: "Lot has no material" }, { status: 500 });
  }
  if (material.ingredient_id !== ingredient_id) {
    return NextResponse.json(
      {
        error: `Lot is for a different ingredient (${material.name}); recipe needs the ingredient you selected.`,
      },
      { status: 422 }
    );
  }

  // 4. Substitution allow-list check (if non-empty for this recipe+ingredient)
  const { data: subs, error: subsErr } = await db
    .from("recipe_ingredient_substitutions")
    .select("raw_material_id, raw_materials(name)")
    .eq("recipe_id", recipe.id)
    .eq("ingredient_id", ingredient_id);
  if (subsErr) return NextResponse.json({ error: subsErr.message }, { status: 500 });

  if (subs && subs.length > 0) {
    const allowed = new Set(subs.map((s) => s.raw_material_id));
    if (!allowed.has(material.id)) {
      const allowedNames = subs
        .map((s) => (s.raw_materials as unknown as { name: string } | null)?.name)
        .filter(Boolean)
        .join(", ");
      return NextResponse.json(
        {
          error: `${material.name} isn't allowed for ${recipe.name}. Allowed materials: ${allowedNames}.`,
        },
        { status: 422 }
      );
    }
  }

  // 5. Atomic decrement of lot quantity_remaining
  const { data: decremented, error: decErr } = await db
    .from("material_lots")
    .update({ quantity_remaining: lot.quantity_remaining - quantity_used })
    .eq("id", material_lot_id)
    .gte("quantity_remaining", quantity_used)
    .select("id, quantity_remaining")
    .maybeSingle();
  if (decErr) return NextResponse.json({ error: decErr.message }, { status: 500 });
  if (!decremented) {
    return NextResponse.json(
      {
        error: `Insufficient stock — lot ${lot.lot_number} has ${lot.quantity_remaining} remaining.`,
      },
      { status: 409 }
    );
  }

  // 6. Insert batch_ingredient row
  const { data: bi, error: biErr } = await db
    .from("batch_ingredients")
    .insert({
      batch_id,
      material_lot_id,
      quantity_used,
    })
    .select("id, batch_id, material_lot_id, quantity_used")
    .single();
  if (biErr) {
    // Best-effort restore of the lot if the insert failed
    await db
      .from("material_lots")
      .update({ quantity_remaining: lot.quantity_remaining })
      .eq("id", material_lot_id);
    return NextResponse.json({ error: biErr.message }, { status: 500 });
  }

  return NextResponse.json({ data: bi }, { status: 201 });
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request, "batches.view");
  if (!auth.ok) return auth.response;

  const { id: batch_id } = await ctx.params;
  const db = admin();

  // Verify batch is in caller's org
  const { data: batch } = await db
    .from("batches")
    .select("id")
    .eq("id", batch_id)
    .eq("org_id", auth.org_id)
    .maybeSingle();
  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  const { data, error } = await db
    .from("batch_ingredients")
    .select(
      "id, quantity_used, material_lot_id, material_lots(id, lot_number, barcode, raw_materials(id, name, ingredient_id))"
    )
    .eq("batch_id", batch_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [] });
}
