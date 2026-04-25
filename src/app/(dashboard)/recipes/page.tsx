import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import Link from "next/link";
import { Plus, ChefHat } from "lucide-react";

export default async function RecipesPage() {
  await requirePermission("recipes.view");
  const canCreate = await checkPermission("recipes.create");

  const supabase = await createClient();

  const { data: recipes } = await supabase
    .from("recipes")
    .select("*, recipe_ingredients(id)")
    .order("name", { ascending: true });

  // Count how many products use each recipe
  const { data: components } = await supabase
    .from("product_components")
    .select("recipe_id")
    .eq("component_type", "recipe");

  const productCountMap: Record<string, number> = {};
  (components || []).forEach((c: any) => {
    if (c.recipe_id) {
      productCountMap[c.recipe_id] = (productCountMap[c.recipe_id] || 0) + 1;
    }
  });

  // Count batches per recipe
  const { data: batchCounts } = await supabase
    .from("batches")
    .select("recipe_id")
    .not("recipe_id", "is", null);

  const batchCountMap: Record<string, number> = {};
  (batchCounts || []).forEach((b: any) => {
    if (b.recipe_id) {
      batchCountMap[b.recipe_id] = (batchCountMap[b.recipe_id] || 0) + 1;
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recipes</h1>
          <p className="text-sm text-gray-500">
            Formulas and instructions for producing your goods
          </p>
        </div>
        {canCreate && (
          <Link
            href="/recipes/new"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} /> New Recipe
          </Link>
        )}
      </div>

      {(recipes || []).length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <ChefHat size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-900">No recipes yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Create your first recipe to define what raw materials go into your products.
          </p>
          {canCreate && (
            <Link
              href="/recipes/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={16} /> New Recipe
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(recipes || []).map((recipe: any) => (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-200 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                  <ChefHat size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 truncate">
                    {recipe.name}
                  </h3>
                  {!recipe.is_active && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      Inactive
                    </span>
                  )}
                </div>
              </div>

              {recipe.description && (
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                  {recipe.description}
                </p>
              )}

              <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-100 pt-3">
                <span>
                  Yield: {recipe.yield_quantity} {recipe.yield_unit}
                </span>
                <span>
                  {(recipe.recipe_ingredients || []).length} ingredients
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
                <span>{productCountMap[recipe.id] || 0} products</span>
                <span>{batchCountMap[recipe.id] || 0} batches</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
