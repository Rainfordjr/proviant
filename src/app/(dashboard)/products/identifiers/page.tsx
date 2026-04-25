import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { IdentifiersRegistry } from "@/components/products/identifiers-registry";

export default async function IdentifiersPage() {
  await requirePermission("products.view");

  const supabase = await createClient();

  // Fetch org for prefix settings
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user!.id)
    .single();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, upc_prefix, gtin_prefix")
    .eq("id", profile!.org_id)
    .single();

  // Fetch all products + components for tree building
  const [{ data: products }, { data: components }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, sku, upc, gtin, is_active, recipe_id")
      .order("name"),
    supabase
      .from("product_components")
      .select("product_id, component_type, component_product_id, quantity, unit"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/products"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={16} /> Back to Products
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">UPC / GTIN Registry</h1>
        <p className="text-sm text-gray-500">
          View all product identifiers in one place. Duplicates are highlighted.
        </p>
      </div>

      <IdentifiersRegistry
        org={org}
        products={products || []}
        components={components || []}
      />
    </div>
  );
}
