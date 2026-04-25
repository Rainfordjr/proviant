import { createClient } from "@/lib/supabase/server";
import { requirePermission, checkPermission } from "@/lib/permissions";
import Link from "next/link";
import { Plus, Users } from "lucide-react";

export default async function CustomersPage() {
  await requirePermission("customers.view");
  const canCreate = await checkPermission("customers.create");

  const supabase = await createClient();

  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .order("name", { ascending: true });

  // Count orders per customer
  const { data: orders } = await supabase
    .from("orders")
    .select("customer_id")
    .not("customer_id", "is", null);

  const orderCountMap: Record<string, number> = {};
  (orders || []).forEach((o: any) => {
    if (o.customer_id) orderCountMap[o.customer_id] = (orderCountMap[o.customer_id] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500">Manage your customer accounts</p>
        </div>
        {canCreate && (
          <Link href="/customers/new"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={16} /> Add Customer
          </Link>
        )}
      </div>

      {(customers || []).length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <Users size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-900">No customers yet</h3>
          <p className="mt-1 text-sm text-gray-500">Add your first customer to start tracking orders.</p>
          {canCreate && (
            <Link href="/customers/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Plus size={16} /> Add Customer
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Location</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Orders</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(customers || []).map((customer: any) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm">
                    <Link href={`/customers/${customer.id}`} className="font-medium text-blue-600 hover:text-blue-800">
                      {customer.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{customer.contact_name || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{customer.email || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{customer.phone || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {customer.city && customer.state ? `${customer.city}, ${customer.state}` : customer.city || customer.state || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{orderCountMap[customer.id] || 0}</td>
                  <td className="px-6 py-4 text-sm">
                    {customer.is_active ? (
                      <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">Active</span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">Inactive</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
