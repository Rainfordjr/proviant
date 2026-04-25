import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import Link from "next/link";
import { Plus, Barcode } from "lucide-react";
import ProductGrid from "@/components/products/product-grid";

export default async function ProductsPage() {
  await requirePermission("products.view");
  const canCreate = await checkPermission("products.create");

  const supabase = await createClient();

  const [
    { data: products },
    { data: categories },
    { data: batchCounts },
    { data: components },
    { data: recipes },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("*, product_categories(name)")
      .order("name", { ascending: true }),
    supabase
      .from("product_categories")
      .select("id, name")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("batches")
      .select("product_id"),
    supabase
      .from("product_components")
      .select("product_id, component_type, component_product_id, recipe_id, quantity, unit"),
    supabase
      .from("recipes")
      .select("id, name")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  const countMap: Record<string, number> = {};
  (batchCounts || []).forEach((b: any) => {
    countMap[b.product_id] = (countMap[b.product_id] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500">Manage your finished products catalog</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/products/identifiers"
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Barcode size={16} /> UPC / GTIN
          </Link>
          {canCreate && (
            <Link href="/products/new"
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Plus size={16} /> Add Product
            </Link>
          )}
        </div>
      </div>

      <ProductGrid
        products={products || []}
        categories={categories || []}
        batchCountMap={countMap}
        components={components || []}
        recipes={recipes || []}
      />
    </div>
  );
}
