"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChefHat, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { generateBatchNumber } from "@/lib/utils";
import { useRequirePermission } from "@/lib/usePermission";

export default function NewBatchPage() {
  const { loading: permLoading } = useRequirePermission("batches.create");
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedRecipeId = searchParams.get("recipe") || "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<any[]>([]);

  const [batchNumber, setBatchNumber] = useState(generateBatchNumber());
  const [recipeId, setRecipeId] = useState(preselectedRecipeId);
  const [status, setStatus] = useState("planned");
  const [quantityProduced, setQuantityProduced] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      // Fetch active recipes
      const { data: recipeData } = await supabase
        .from("recipes")
        .select("id, name, yield_quantity, yield_unit")
        .eq("is_active", true)
        .order("name");

      // Fetch products that are linked to recipes (products.recipe_id)
      const { data: productData } = await supabase
        .from("products")
        .select("id, name, sku, recipe_id")
        .not("recipe_id", "is", null);

      // Attach product to each recipe
      const recipesWithProducts = (recipeData || []).map((r: any) => {
        const product = (productData || []).find((p: any) => p.recipe_id === r.id);
        return { ...r, product: product || null };
      });

      setRecipes(recipesWithProducts);
    };
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!recipeId) { setError("Please select a recipe."); setLoading(false); return; }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("You must be logged in."); setLoading(false); return; }

    const { data: profile } = await supabase.from("users").select("org_id").eq("id", user.id).single();
    if (!profile) { setError("Could not find your organization."); setLoading(false); return; }

    const selectedRecipe = recipes.find((r) => r.id === recipeId);

    const { error: insertError } = await supabase.from("batches").insert({
      org_id: profile.org_id,
      recipe_id: recipeId,
      product_id: selectedRecipe?.product?.id || null,
      batch_number: batchNumber,
      status,
      quantity_produced: quantityProduced ? parseFloat(quantityProduced) : null,
      produced_at: status === "completed" ? new Date().toISOString() : null,
      notes: notes || null,
      created_by: user.id,
    });

    setLoading(false);
    if (insertError) {
      if (insertError.message.includes("duplicate") || insertError.message.includes("unique")) {
        setError("A batch with that number already exists. Try generating a new one.");
      } else {
        setError(insertError.message);
      }
      return;
    }

    router.push("/batches");
    router.refresh();
  };

  if (permLoading) return <div className="p-8 text-center text-sm text-gray-500">Checking permissions…</div>;

  const selectedRecipe = recipes.find((r) => r.id === recipeId);
  const linkedProduct = selectedRecipe?.product;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/batches" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={16} /> Back to Batches
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Production Batch</h1>
        <p className="text-sm text-gray-500">Start a new production run from a recipe</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div>
          <label htmlFor="batchNumber" className="block text-sm font-medium text-gray-700">Batch Number *</label>
          <div className="mt-1 flex gap-2">
            <input id="batchNumber" type="text" required value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)}
              className="block flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <button type="button" onClick={() => setBatchNumber(generateBatchNumber())}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
              Generate
            </button>
          </div>
        </div>

        {/* Recipe selection */}
        <div>
          <label htmlFor="recipe" className="block text-sm font-medium text-gray-700">
            <span className="inline-flex items-center gap-1"><ChefHat size={14} /> Recipe *</span>
          </label>
          <select id="recipe" required value={recipeId} onChange={(e) => setRecipeId(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">Select a recipe...</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} (yields {r.yield_quantity} {r.yield_unit})
              </option>
            ))}
          </select>
          {recipes.length === 0 && (
            <p className="mt-1 text-xs text-gray-500">
              No recipes found. <Link href="/recipes/new" className="text-blue-600 hover:underline">Create one first</Link>.
            </p>
          )}
        </div>

        {/* Linked product (read-only, from recipe) */}
        {linkedProduct && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              <span className="inline-flex items-center gap-1"><ShoppingBag size={14} /> Output Product</span>
            </label>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {linkedProduct.name}
              <span className="text-gray-400">({linkedProduct.sku})</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Automatically linked from the selected recipe.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status *</label>
            <select id="status" value={status} onChange={(e) => setStatus(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="planned">Planned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>
          <div>
            <label htmlFor="qty" className="block text-sm font-medium text-gray-700">Quantity Produced</label>
            <input id="qty" type="number" step="0.01" min="0" value={quantityProduced} onChange={(e) => setQuantityProduced(e.target.value)}
              placeholder="Leave blank if not done"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes about this production run"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/batches" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</Link>
          <button type="submit" disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Creating..." : "Create Batch"}
          </button>
        </div>
      </form>
    </div>
  );
}
