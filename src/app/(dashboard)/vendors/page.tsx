import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import Link from "next/link";
import { Plus, CheckCircle, XCircle } from "lucide-react";

export default async function VendorsPage() {
  await requirePermission("suppliers.view");
  const canCreate = await checkPermission("suppliers.create");

  const supabase = await createClient();

  // Fetch suppliers with a count of linked materials
  const { data: vendors } = await supabase
    .from("suppliers")
    .select("*, raw_materials(id)")
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
          <p className="text-sm text-gray-500">Manage your raw material suppliers</p>
        </div>
        {canCreate && (
          <Link href="/vendors/new"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={16} /> Add Vendor
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Vendor</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Account #</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Payment Terms</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Materials</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(vendors || []).map((v: any) => (
              <tr key={v.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <Link href={`/vendors/${v.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                    {v.name}
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {v.contact_name || "—"}
                  {v.email && <span className="block text-xs text-gray-400">{v.email}</span>}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{v.account_number || "—"}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{v.payment_terms || "—"}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{(v.raw_materials || []).length}</td>
                <td className="px-6 py-4">
                  {v.is_active ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                      <CheckCircle size={12} /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                      <XCircle size={12} /> Inactive
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {(vendors || []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                  No vendors yet. Add your first vendor to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
