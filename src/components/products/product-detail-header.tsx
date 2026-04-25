"use client";

import { useRouter } from "next/navigation";
import { Factory, Truck, CheckCircle, XCircle } from "lucide-react";
import { InlineEdit } from "@/components/ui/inline-edit";
import { createClient } from "@/lib/supabase/client";

interface Props {
  product: any;
  canEdit: boolean;
}

export function ProductDetailHeader({ product, canEdit }: Props) {
  const router = useRouter();

  const save = async (field: string, value: any) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("products")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("id", product.id);
    if (error) throw error;
    router.refresh();
  };

  const toggleActive = async () => {
    await save("is_active", !product.is_active);
  };

  return (
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-2">
          {product.product_type === "production" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              <Factory size={10} /> Production
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
              <Truck size={10} /> Distribution
            </span>
          )}
        </div>

        {canEdit ? (
          <InlineEdit
            value={product.name}
            onSave={(v) => save("name", v)}
            allowEmpty={false}
            size="lg"
            renderDisplay={(v) => (
              <span className="text-2xl font-bold text-gray-900">{v}</span>
            )}
          />
        ) : (
          <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
        )}
      </div>

      {/* Active toggle */}
      {canEdit ? (
        <button
          onClick={toggleActive}
          className="group"
          title={product.is_active ? "Click to deactivate" : "Click to activate"}
        >
          {product.is_active ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700 group-hover:bg-green-100 transition-colors">
              <CheckCircle size={14} /> Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-500 group-hover:bg-gray-200 transition-colors">
              <XCircle size={14} /> Inactive
            </span>
          )}
        </button>
      ) : (
        product.is_active ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
            <CheckCircle size={14} /> Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-500">
            <XCircle size={14} /> Inactive
          </span>
        )
      )}
    </div>
  );
}
