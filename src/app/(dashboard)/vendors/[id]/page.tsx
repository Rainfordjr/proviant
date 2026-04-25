import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, MapPin, Hash, CreditCard, CheckCircle, XCircle, Pencil } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("suppliers.view");
  const canEdit = await checkPermission("suppliers.edit");

  const { id } = await params;
  const supabase = await createClient();

  const { data: vendor } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .single();

  if (!vendor) return notFound();

  // Fetch materials linked to this vendor
  const { data: materials } = await supabase
    .from("raw_materials")
    .select("id, name, unit, current_stock, reorder_point, is_active")
    .eq("supplier_id", id)
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/vendors" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={16} /> Back to Vendors
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{vendor.name}</h1>
            {vendor.contact_name && (
              <p className="text-sm text-gray-500">Contact: {vendor.contact_name}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {vendor.is_active ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                <CheckCircle size={14} /> Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-500">
                <XCircle size={14} /> Inactive
              </span>
            )}
            {canEdit && (
              <Link href={`/vendors/${id}/edit`}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                <Pencil size={14} /> Edit Vendor
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Contact & account info cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {vendor.email && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Mail size={16} /> <span className="text-xs font-medium uppercase">Email</span>
            </div>
            <p className="text-sm font-medium text-gray-900">{vendor.email}</p>
          </div>
        )}
        {vendor.phone && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Phone size={16} /> <span className="text-xs font-medium uppercase">Phone</span>
            </div>
            <p className="text-sm font-medium text-gray-900">{vendor.phone}</p>
          </div>
        )}
        {vendor.address && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <MapPin size={16} /> <span className="text-xs font-medium uppercase">Address</span>
            </div>
            <p className="text-sm font-medium text-gray-900">{vendor.address}</p>
          </div>
        )}
        {vendor.account_number && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Hash size={16} /> <span className="text-xs font-medium uppercase">Account #</span>
            </div>
            <p className="text-sm font-medium text-gray-900">{vendor.account_number}</p>
          </div>
        )}
        {vendor.payment_terms && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <CreditCard size={16} /> <span className="text-xs font-medium uppercase">Payment Terms</span>
            </div>
            <p className="text-sm font-medium text-gray-900">{vendor.payment_terms}</p>
          </div>
        )}
      </div>

      {/* Notes */}
      {vendor.notes && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
          <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{vendor.notes}</p>
        </div>
      )}

      {/* Linked materials */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Linked Materials</h2>
        <p className="text-sm text-gray-500 mb-4">Raw materials supplied by this vendor</p>

        {(materials || []).length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No materials linked to this vendor yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Material</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Current Stock</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Reorder Point</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(materials || []).map((mat: any) => {
                const isLow = mat.current_stock <= mat.reorder_point;
                return (
                  <tr key={mat.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <Link href={`/materials/${mat.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                        {mat.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{mat.current_stock} {mat.unit}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{mat.reorder_point} {mat.unit}</td>
                    <td className="px-4 py-3 text-sm">
                      {isLow ? (
                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">Low Stock</span>
                      ) : (
                        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">In Stock</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="text-xs text-gray-400">
        Created {formatDate(vendor.created_at)} · Last updated {formatDate(vendor.updated_at)}
      </div>
    </div>
  );
}
