import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import Link from "next/link";
import { ArrowLeft, ChefHat, Wheat, Package, Layers, CheckCircle, XCircle, Plus, Clock, FileText, Pencil, Play, ShoppingBag } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { VERSION_STATUSES } from "@/lib/constants";
import { notFound } from "next/navigation";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("recipes.view");
  const canEdit = await checkPermission("recipes.edit");
  const canCreateBatch = await checkPermission("batches.create");

  const { id } = await params;
  const supabase = await createClient();

  // Fetch recipe
  const { data: recipe } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();

  if (!recipe) return notFound();

  // Fetch all versions
  const { data: versions } = await supabase
    .from("recipe_versions")
    .select("*")
    .eq("recipe_id", id)
    .order("version_number", { ascending: false });

  // Get the current approved version (or latest draft)
  const currentVersion = recipe.current_version_id
    ? (versions || []).find((v: any) => v.id === recipe.current_version_id)
    : null;

  const latestDraft = (versions || []).find((v: any) => v.status === "draft");
  const submittedVersion = (versions || []).find((v: any) => v.status === "submitted");

  // Fetch ingredients and sections for the current approved version
  let currentIngredients: any[] = [];
  let currentSections: any[] = [];
  if (currentVersion) {
    const [{ data: ings }, { data: secs }] = await Promise.all([
      supabase
        .from("recipe_version_ingredients")
        .select("*, raw_materials(name, unit, current_stock)")
        .eq("recipe_version_id", currentVersion.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("recipe_version_sections")
        .select("*")
        .eq("recipe_version_id", currentVersion.id)
        .order("sort_order", { ascending: true }),
    ]);
    currentIngredients = ings || [];
    currentSections = secs || [];
  }

  // Also check old-style recipe_ingredients for backward compat
  if (currentIngredients.length === 0) {
    const { data } = await supabase
      .from("recipe_ingredients")
      .select("*, raw_materials(name, unit, current_stock)")
      .eq("recipe_id", id)
      .order("sort_order", { ascending: true });
    currentIngredients = data || [];
  }

  // Group ingredients by section
  const unsectionedIngredients = currentIngredients.filter((i: any) => !i.section_id);
  const sectionedGroups = currentSections.map((sec: any) => ({
    ...sec,
    ingredients: currentIngredients.filter((i: any) => i.section_id === sec.id),
  }));

  // Fetch the linked output product (product references recipe via products.recipe_id)
  const { data: linkedProduct } = await supabase
    .from("products")
    .select("id, name, sku")
    .eq("recipe_id", id)
    .maybeSingle();

  // Fetch products using this recipe (via product_components)
  const { data: productComponents } = await supabase
    .from("product_components")
    .select("*, products!product_components_product_id_fkey(id, name, sku)")
    .eq("recipe_id", id)
    .eq("component_type", "recipe");

  // Fetch recent batches
  const { data: batches } = await supabase
    .from("batches")
    .select("*, recipe_versions(version_number)")
    .eq("recipe_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const hasAnyDraft = latestDraft != null;
  const hasSubmitted = submittedVersion != null;

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <Link href="/recipes" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={16} /> Back to Recipes
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <ChefHat size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{recipe.name}</h1>
              {currentVersion ? (
                <p className="text-sm text-gray-500">
                  Current: v{currentVersion.version_number} (Approved) · Yield: {currentVersion.yield_quantity} {currentVersion.yield_unit}
                </p>
              ) : (
                <p className="text-sm text-yellow-600">No approved version yet</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {recipe.is_active ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                <CheckCircle size={14} /> Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-500">
                <XCircle size={14} /> Inactive
              </span>
            )}
            {canEdit && (
              <Link
                href={`/recipes/${id}/edit`}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Pencil size={16} /> Edit Recipe
              </Link>
            )}
            {canEdit && !hasAnyDraft && !hasSubmitted && (
              <Link
                href={`/recipes/${id}/versions/new`}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus size={16} /> New Draft
              </Link>
            )}
            {canCreateBatch && (
              <Link
                href={`/batches/new?recipe=${id}`}
                className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                <Play size={16} /> Start Batch
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Output product banner */}
      {linkedProduct && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
          <div className="flex items-center gap-2">
            <ShoppingBag size={16} className="text-purple-600" />
            <p className="text-sm font-medium text-purple-800">
              Output: <Link href={`/products/${linkedProduct.id}`} className="underline hover:text-purple-900">{linkedProduct.name}</Link> ({linkedProduct.sku})
            </p>
          </div>
        </div>
      )}

      {/* Status banner if there's a pending draft or submitted version */}
      {hasSubmitted && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-800">
                Version {submittedVersion.version_number} is awaiting approval
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                Submitted {submittedVersion.submitted_at ? formatDateTime(submittedVersion.submitted_at) : "recently"}
              </p>
            </div>
            <Link
              href={`/recipes/${id}/versions/${submittedVersion.id}`}
              className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
            >
              Review
            </Link>
          </div>
        </div>
      )}

      {hasAnyDraft && !hasSubmitted && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">
                Draft v{latestDraft.version_number} in progress
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {latestDraft.change_notes || "No notes yet"}
              </p>
            </div>
            <Link
              href={`/recipes/${id}/versions/${latestDraft.id}/edit`}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Edit Draft
            </Link>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <FileText size={16} /> <span className="text-xs font-medium uppercase">Versions</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{(versions || []).length}</p>
          <p className="text-xs text-gray-400">
            {(versions || []).filter((v: any) => v.status === "approved").length} approved
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Wheat size={16} /> <span className="text-xs font-medium uppercase">Ingredients</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{currentIngredients.length}</p>
          <p className="text-xs text-gray-400">in current version</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Package size={16} /> <span className="text-xs font-medium uppercase">Products</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{(productComponents || []).length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Layers size={16} /> <span className="text-xs font-medium uppercase">Batches</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{(batches || []).length}</p>
        </div>
      </div>

      {/* Description */}
      {recipe.description && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Description</h2>
          <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{recipe.description}</p>
        </div>
      )}

      {/* Current approved version ingredients */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Ingredients {currentVersion ? `(v${currentVersion.version_number})` : ""}
          </h2>
          <p className="text-sm text-gray-500">Raw materials in the current approved version</p>
        </div>

        {currentIngredients.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No ingredients defined yet. Create a draft version to add ingredients.</p>
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
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Material</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Quantity</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Unit</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">In Stock</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {unsectionedIngredients.map((ing: any, idx: number) => (
                      <tr key={ing.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-400">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{ing.raw_materials?.name || "Unknown"}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{ing.quantity}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{ing.unit}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={
                            (ing.raw_materials?.current_stock || 0) < ing.quantity
                              ? "text-red-600 font-medium" : "text-gray-700"
                          }>
                            {ing.raw_materials?.current_stock ?? "—"} {ing.raw_materials?.unit || ""}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{ing.notes || "—"}</td>
                      </tr>
                    ))}
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
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Material</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Quantity</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Unit</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">In Stock</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {group.ingredients.map((ing: any, idx: number) => (
                        <tr key={ing.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{ing.raw_materials?.name || "Unknown"}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{ing.quantity}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{ing.unit}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={
                              (ing.raw_materials?.current_stock || 0) < ing.quantity
                                ? "text-red-600 font-medium" : "text-gray-700"
                            }>
                              {ing.raw_materials?.current_stock ?? "—"} {ing.raw_materials?.unit || ""}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{ing.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Instructions from current version */}
      {(currentVersion?.instructions || recipe.instructions) && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Instructions</h2>
          <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
            {currentVersion?.instructions || recipe.instructions}
          </div>
        </div>
      )}

      {/* Version History */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Version History</h2>
        <p className="text-sm text-gray-500 mb-4">All revisions of this recipe</p>

        {(versions || []).length === 0 ? (
          <div className="text-sm text-gray-500 py-4 text-center">
            <p>No versions yet.</p>
            {canEdit && (
              <Link
                href={`/recipes/${id}/versions/new`}
                className="mt-2 inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
              >
                <Plus size={14} /> Create first draft
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Version</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Yield</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Change Notes</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Created</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Approved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(versions || []).map((v: any) => {
                const statusInfo = VERSION_STATUSES[v.status as keyof typeof VERSION_STATUSES];
                const isCurrent = recipe.current_version_id === v.id;
                return (
                  <tr key={v.id} className={`hover:bg-gray-50 ${isCurrent ? "bg-green-50/50" : ""}`}>
                    <td className="px-4 py-3 text-sm">
                      <Link
                        href={`/recipes/${id}/versions/${v.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        v{v.version_number}
                      </Link>
                      {isCurrent && (
                        <span className="ml-2 text-xs text-green-700 font-medium">Current</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo?.color || "bg-gray-100 text-gray-800"}`}>
                        {statusInfo?.label || v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{v.yield_quantity} {v.yield_unit}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{v.change_notes || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(v.created_at)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {v.approved_at ? formatDate(v.approved_at) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Products using this recipe */}
      {(productComponents || []).length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Products Using This Recipe</h2>
          <p className="text-sm text-gray-500 mb-4">Products that contain output from this recipe</p>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Product</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">SKU</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Qty</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(productComponents || []).map((comp: any) => (
                <tr key={comp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <Link href={`/products/${comp.products?.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                      {comp.products?.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{comp.products?.sku}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{comp.quantity}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{comp.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent Batches */}
      {(batches || []).length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Recent Batches</h2>
          <table className="w-full mt-4">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Batch</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Type</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Version</th>
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
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {batch.recipe_versions?.version_number ? `v${batch.recipe_versions.version_number}` : "—"}
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

      <div className="text-xs text-gray-400">
        Created {formatDate(recipe.created_at)} · Last updated {formatDate(recipe.updated_at)}
      </div>
    </div>
  );
}
