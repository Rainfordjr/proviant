"use client";

import { useRouter } from "next/navigation";
import { Layers, Package } from "lucide-react";
import { InlineEdit } from "@/components/ui/inline-edit";
import { createClient } from "@/lib/supabase/client";
import { UNITS } from "@/lib/constants";

interface Props {
  product: any;
  categories: { id: string; name: string }[];
  componentCount: number;
  parentCount: number;
  canEdit: boolean;
}

export function ProductDetailInfo({
  product,
  categories,
  componentCount,
  parentCount,
  canEdit,
}: Props) {
  const router = useRouter();

  const save = async (field: string, value: any) => {
    const supabase = createClient();
    const update: any = { [field]: value, updated_at: new Date().toISOString() };
    if (field === "category_id") {
      update.category = categories.find((c) => c.id === value)?.name || "general";
    }
    const { error } = await supabase
      .from("products")
      .update(update)
      .eq("id", product.id);
    if (error) throw error;
    router.refresh();
  };

  const unitOptions = UNITS.map((u) => ({ value: u.value, label: u.label }));
  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  const categoryName = product.product_categories?.name || product.category;
  const unitLabel = UNITS.find((u) => u.value === product.unit)?.label || product.unit;

  return (
    <div className="space-y-4">
      {/* Editable fields card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
          {/* SKU */}
          {canEdit ? (
            <InlineEdit
              label="SKU"
              value={product.sku}
              onSave={(v) => save("sku", v)}
              allowEmpty={false}
              size="sm"
            />
          ) : (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">SKU</div>
              <div className="text-sm text-gray-900">{product.sku}</div>
            </div>
          )}

          {/* UPC */}
          {canEdit ? (
            <InlineEdit
              label="UPC"
              value={product.upc || ""}
              onSave={(v) => save("upc", v || null)}
              size="sm"
              placeholder="Not set"
            />
          ) : (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">UPC</div>
              <div className="text-sm text-gray-900">{product.upc || <span className="text-gray-400 italic">Not set</span>}</div>
            </div>
          )}

          {/* GTIN */}
          {canEdit ? (
            <InlineEdit
              label="GTIN"
              value={product.gtin || ""}
              onSave={(v) => save("gtin", v || null)}
              size="sm"
              placeholder="Not set"
            />
          ) : (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">GTIN</div>
              <div className="text-sm text-gray-900">{product.gtin || <span className="text-gray-400 italic">Not set</span>}</div>
            </div>
          )}

          {/* Unit */}
          {canEdit ? (
            <InlineEdit
              label="Unit"
              value={product.unit}
              onSave={(v) => save("unit", v)}
              type="select"
              options={unitOptions}
              allowEmpty={false}
              size="sm"
              renderDisplay={() => (
                <span className="text-sm text-gray-900 capitalize">{unitLabel}</span>
              )}
            />
          ) : (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">Unit</div>
              <div className="text-sm text-gray-900 capitalize">{unitLabel}</div>
            </div>
          )}

          {/* Category */}
          {canEdit ? (
            <InlineEdit
              label="Category"
              value={product.category_id || ""}
              onSave={(v) => save("category_id", v || null)}
              type="select"
              options={categoryOptions}
              size="sm"
              placeholder="No category"
              renderDisplay={() => (
                <span className="text-sm text-gray-900 capitalize">
                  {categoryName || <span className="text-gray-400 italic normal-case">No category</span>}
                </span>
              )}
            />
          ) : (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">Category</div>
              <div className="text-sm text-gray-900 capitalize">{categoryName || <span className="text-gray-400 italic normal-case">No category</span>}</div>
            </div>
          )}

          {/* Stats (read-only) */}
          <div className="flex gap-8">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">Components</div>
              <div className="flex items-center gap-1.5 text-sm text-gray-900">
                <Layers size={14} className="text-gray-400" />
                {componentCount}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">Used in</div>
              <div className="flex items-center gap-1.5 text-sm text-gray-900">
                <Package size={14} className="text-gray-400" />
                {parentCount}
              </div>
            </div>
          </div>
        </div>

        {/* Description — full width below the grid */}
        <div className="mt-5 pt-5 border-t border-gray-100">
          {canEdit ? (
            <InlineEdit
              label="Description"
              value={product.description || ""}
              onSave={(v) => save("description", v || null)}
              type="textarea"
              placeholder="No description — click to add"
              size="sm"
              className="w-full"
            />
          ) : (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">Description</div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {product.description || <span className="text-gray-400 italic">No description</span>}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
