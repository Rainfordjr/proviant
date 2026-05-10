import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";

export default async function LotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("inventory.view");
  const { id } = await params;
  const supabase = await createClient();

  const { data: lot } = await supabase
    .from("material_lots")
    .select("*, raw_materials(id, name, unit, ingredients(id, name))")
    .eq("id", id)
    .maybeSingle();

  if (!lot) return notFound();
  const material = (lot as { raw_materials: { id: string; name: string; unit: string; ingredients: { id: string; name: string } | null } | null }).raw_materials;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/inventory/stock" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-3">
          <ArrowLeft size={16} /> Back to Stock
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lot {lot.lot_number}</h1>
            <p className="text-sm text-gray-500">
              {material?.name}
              {material?.ingredients?.name ? ` — ${material.ingredients.name}` : ""}
            </p>
          </div>
          <Link
            href={`/inventory/lots/${id}/label`}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Printer size={16} /> Print Label
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm grid grid-cols-2 gap-6 text-sm">
        <Field label="Barcode" value={lot.barcode || "—"} mono />
        <Field label="Supplier Lot #" value={lot.supplier_lot_number || "—"} />
        <Field label="Quantity Received" value={`${lot.quantity} ${material?.unit || ""}`} />
        <Field label="Quantity Remaining" value={`${lot.quantity_remaining} ${material?.unit || ""}`} />
        <Field label="Expiry Date" value={lot.expiry_date ? formatDate(lot.expiry_date) : "—"} />
        <Field label="Received At" value={formatDateTime(lot.received_at)} />
        {lot.notes && (
          <div className="col-span-2">
            <p className="text-xs uppercase font-semibold text-gray-500">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-gray-700">{lot.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase font-semibold text-gray-500">{label}</p>
      <p className={`mt-1 text-gray-900 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
