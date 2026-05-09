import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import Link from "next/link";
import { ArrowLeft, Lock, FileText, Pencil } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { VERSION_STATUSES } from "@/lib/constants";
import { notFound } from "next/navigation";
import { VersionActions } from "@/components/recipes/version-actions";

export default async function RecipeVersionDetailPage({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>;
}) {
  await requirePermission("recipes.view");
  const canEdit = await checkPermission("recipes.edit");

  const { id, versionId } = await params;
  const supabase = await createClient();

  // Fetch recipe
  const { data: recipe } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();

  if (!recipe) return notFound();

  // Fetch version
  const { data: version } = await supabase
    .from("recipe_versions")
    .select("*")
    .eq("id", versionId)
    .eq("recipe_id", id)
    .single();

  if (!version) return notFound();

  // Fetch version ingredients and sections
  const [{ data: ingredients }, { data: versionSections }] = await Promise.all([
    supabase
      .from("recipe_version_ingredients")
      .select("*, ingredients(id, name, unit)")
      .eq("recipe_version_id", versionId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("recipe_version_sections")
      .select("*")
      .eq("recipe_version_id", versionId)
      .order("sort_order", { ascending: true }),
  ]);

  const unsectionedIngredients = (ingredients || []).filter((i: any) => !i.section_id);
  const sectionedGroups = (versionSections || []).map((sec: any) => ({
    ...sec,
    ingredients: (ingredients || []).filter((i: any) => i.section_id === sec.id),
  }));

  // Aggregate stock per ingredient (sum across all raw_materials with that ingredient_id)
  const ingredientIds = Array.from(new Set(
    (ingredients || []).map((i: any) => i.ingredient_id).filter(Boolean)
  ));
  const stockByIngredient = new Map<string, number>();
  if (ingredientIds.length > 0) {
    const { data: rmStock } = await supabase
      .from("raw_materials")
      .select("ingredient_id, current_stock")
      .in("ingredient_id", ingredientIds as string[]);
    for (const r of rmStock || []) {
      const cur = stockByIngredient.get((r as any).ingredient_id) || 0;
      stockByIngredient.set((r as any).ingredient_id, cur + Number((r as any).current_stock || 0));
    }
  }
  const ingStock = (ing: any) => stockByIngredient.get(ing.ingredient_id) ?? 0;

  // Fetch batches using this version
  const { data: batches } = await supabase
    .from("batches")
    .select("*")
    .eq("recipe_version_id", versionId)
    .order("created_at", { ascending: false })
    .limit(10);

  const statusInfo = VERSION_STATUSES[version.status as keyof typeof VERSION_STATUSES];
  const isLocked = version.status === "approved";
  const isCurrent = recipe.current_version_id === version.id;

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <Link href={`/recipes/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={16} /> Back to {recipe.name}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {recipe.name} — v{version.version_number}
            </h1>
            <p className="text-sm text-gray-500">
              Yield: {version.yield_quantity} {version.yield_unit}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusInfo?.color || "bg-gray-100 text-gray-800"}`}>
              {statusInfo?.label || version.status}
            </span>
            {isCurrent && (
              <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                Current
              </span>
            )}
            {isLocked && (
              <span className="inline-flex items-center gap-1 text-sm text-gray-500">
                <Lock size={14} /> Locked
              </span>
            )}
            {canEdit && version.status === "draft" && (
              <Link
                href={`/recipes/${id}/versions/${versionId}/edit`}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Pencil size={16} /> Edit Draft
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Approval actions */}
      {(version.status === "draft" || version.status === "submitted") && (
        <VersionActions
          versionId={version.id}
          recipeId={id}
          status={version.status}
        />
      )}

      {/* Rejection notice */}
      {version.status === "rejected" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">This version was rejected</p>
          {version.rejection_notes && (
            <p className="text-sm text-red-700 mt-1">{version.rejection_notes}</p>
          )}
          <p className="text-xs text-red-500 mt-2">
            Rejected {version.rejected_at ? formatDateTime(version.rejected_at) : ""}
          </p>
        </div>
      )}

      {/* Change notes */}
      {version.change_notes && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Change Notes</h2>
          <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{version.change_notes}</p>
        </div>
      )}

      {/* Audit trail */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Audit Trail</h2>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <span className="w-24 font-medium text-gray-500">Created:</span>
            {formatDateTime(version.created_at)}
          </div>
          {version.submitted_at && (
            <div className="flex items-center gap-2 text-gray-600">
              <span className="w-24 font-medium text-gray-500">Submitted:</span>
              {formatDateTime(version.submitted_at)}
            </div>
          )}
          {version.approved_at && (
            <div className="flex items-center gap-2 text-green-700">
              <span className="w-24 font-medium text-green-600">Approved:</span>
              {formatDateTime(version.approved_at)}
            </div>
          )}
          {version.rejected_at && (
            <div className="flex items-center gap-2 text-red-700">
              <span className="w-24 font-medium text-red-600">Rejected:</span>
              {formatDateTime(version.rejected_at)}
            </div>
          )}
        </div>
      </div>

      {/* Ingredients */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Ingredients</h2>
          <p className="text-sm text-gray-500">
            {isLocked ? "These ingredients are locked and cannot be changed." : "Ingredients for this version."}
          </p>
        </div>

        {(ingredients || []).length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No ingredients defined for this version.</p>
        ) : (
          <>
            {/* Unsectioned ingredients */}
            {unsectionedIngredients.length > 0 && (
              <div>
                {sectionedGroups.length > 0 && (
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">General</h3>
                )}
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">#</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Ingredient</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Quantity</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Unit</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">In Stock</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {unsectionedIngredients.map((ing: any, idx: number) => {
                      const stock = ingStock(ing);
                      return (
                        <tr key={ing.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{ing.ingredients?.name || "Unknown"}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{ing.quantity}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{ing.unit}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={stock < ing.quantity ? "text-red-600 font-medium" : "text-gray-700"}>
                              {stock} {ing.ingredients?.unit || ""}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{ing.notes || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Sectioned ingredients */}
            {sectionedGroups.map((group: any) => (
              <div key={group.id} className="rounded-lg border border-blue-100 overflow-hidden">
                <div className="bg-blue-50 px-4 py-2 border-b border-blue-100">
                  <h3 className="text-sm font-semibold text-blue-900">{group.name}</h3>
                  {group.notes && <p className="text-xs text-blue-600 mt-0.5">{group.notes}</p>}
                </div>
                {group.ingredients.length === 0 ? (
                  <p className="text-sm text-gray-500 py-3 text-center">No ingredients in this section.</p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">#</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Ingredient</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Quantity</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Unit</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">In Stock</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {group.ingredients.map((ing: any, idx: number) => {
                        const stock = ingStock(ing);
                        return (
                          <tr key={ing.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-400">{idx + 1}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{ing.ingredients?.name || "Unknown"}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{ing.quantity}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{ing.unit}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={stock < ing.quantity ? "text-red-600 font-medium" : "text-gray-700"}>
                                {stock} {ing.ingredients?.unit || ""}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">{ing.notes || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Instructions */}
      {version.instructions && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Instructions</h2>
          <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{version.instructions}</div>
        </div>
      )}

      {/* Batches using this version */}
      {(batches || []).length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Batches Using This Version</h2>
          <table className="w-full mt-4">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Batch</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Type</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Qty</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(batches || []).map((batch: any) => (
                <tr key={batch.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <Link href={`/batches/${batch.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                      {batch.batch_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {batch.batch_type === "development" ? (
                      <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">Dev</span>
                    ) : (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">Prod</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm capitalize text-gray-700">{batch.status.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{batch.quantity_produced ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(batch.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
