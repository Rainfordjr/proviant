"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Factory, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRequirePermission } from "@/lib/usePermission";
import { UnitSelect } from "@/components/ui/unit-select";

export default function NewProductPage() {
  const { loading: permLoading } = useRequirePermission("products.create");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [upc, setUpc] = useState("");
  const [gtin, setGtin] = useState("");
  const [productType, setProductType] = useState<"production" | "distribution">("production");
  const [categoryId, setCategoryId] = useState("");
  const [unit, setUnit] = useState("units");
  const [description, setDescription] = useState("");

  useEffect(() => {
    const fetchCategories = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("product_categories")
        .select("id, name")
        .eq("is_active", true)
        .order("sort_order")
        .order("name");
      setCategories(data || []);
    };
    fetchCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("You must be logged in."); setLoading(false); return; }

    const { data: profile } = await supabase.from("users").select("org_id").eq("id", user.id).single();
    if (!profile) { setError("Could not find your organization."); setLoading(false); return; }

    const { error: insertError } = await supabase.from("products").insert({
      org_id: profile.org_id,
      name,
      sku,
      upc: upc || null,
      gtin: gtin || null,
      product_type: productType,
      category_id: categoryId || null,
      category: categories.find((c) => c.id === categoryId)?.name || "general",
      unit,
      description: description || null,
    });

    setLoading(false);

    if (insertError) {
      if (insertError.message.includes("duplicate") || insertError.message.includes("unique")) {
        setError("A product with that SKU already exists.");
      } else {
        setError(insertError.message);
      }
      return;
    }

    router.push("/products");
    router.refresh();
  };

  if (permLoading) return <div className="p-8 text-center text-sm text-gray-500">Checking permissions…</div>;

  const inputClass = "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/products" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={16} /> Back to Products
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Add New Product</h1>
        <p className="text-sm text-gray-500">Create a new product in your catalog</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {/* Product Type Toggle */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-3">Product Type *</label>
          <div className="grid grid-cols-2 gap-4">
            <button type="button" onClick={() => setProductType("production")}
              className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                productType === "production"
                  ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                  : "border-gray-200 hover:border-gray-300"
              }`}>
              <div className={`rounded-lg p-2 ${productType === "production" ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"}`}>
                <Factory size={24} />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Production</div>
                <div className="text-xs text-gray-500">Manufactured in-house</div>
              </div>
            </button>
            <button type="button" onClick={() => setProductType("distribution")}
              className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                productType === "distribution"
                  ? "border-purple-500 bg-purple-50 ring-1 ring-purple-500"
                  : "border-gray-200 hover:border-gray-300"
              }`}>
              <div className={`rounded-lg p-2 ${productType === "distribution" ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-500"}`}>
                <Truck size={24} />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Distribution</div>
                <div className="text-xs text-gray-500">Resold from a supplier</div>
              </div>
            </button>
          </div>
        </div>

        {/* Details */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Product Name *</label>
            <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Sourdough Loaf" className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="sku" className="block text-sm font-medium text-gray-700">SKU *</label>
              <input id="sku" type="text" required value={sku} onChange={(e) => setSku(e.target.value)}
                placeholder="e.g., BRD-SD-001" className={inputClass} />
            </div>
            <div>
              <label htmlFor="unit" className="block text-sm font-medium text-gray-700">Unit *</label>
              <UnitSelect id="unit" value={unit} onChange={setUnit} required showPlaceholder={false} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="upc" className="block text-sm font-medium text-gray-700">UPC</label>
              <input id="upc" type="text" value={upc} onChange={(e) => setUpc(e.target.value)}
                placeholder="e.g., 012345678905" className={inputClass} />
              <p className="mt-1 text-xs text-gray-400">12-digit Universal Product Code</p>
            </div>
            <div>
              <label htmlFor="gtin" className="block text-sm font-medium text-gray-700">GTIN</label>
              <input id="gtin" type="text" value={gtin} onChange={(e) => setGtin(e.target.value)}
                placeholder="e.g., 00012345678905" className={inputClass} />
              <p className="mt-1 text-xs text-gray-400">14-digit Global Trade Item Number</p>
            </div>
          </div>

          <div>
            <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700">Category</label>
            <div className="flex gap-2">
              <select id="categoryId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
                <option value="">No category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Link href="/products/categories"
                className="mt-1 shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                title="Manage categories">
                Manage
              </Link>
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
            <textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of the product" className={inputClass} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link href="/products"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
          <button type="submit" disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Creating..." : "Create Product"}
          </button>
        </div>
      </form>
    </div>
  );
}
