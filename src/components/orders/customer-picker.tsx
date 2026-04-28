"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface CustomerLite {
  id: string;
  name: string;
  email: string | null;
}

interface Props {
  /** Current customer_id (null = walk-in / not linked). */
  customerId: string | null;
  /** Current customer_name on the order (kept editable for overrides). */
  customerName: string;
  /** Current customer_email on the order (kept editable for overrides). */
  customerEmail: string;
  /** Called whenever any of the three values changes. */
  onChange: (next: {
    customerId: string | null;
    customerName: string;
    customerEmail: string;
  }) => void;
}

/**
 * Customer selector with manual override.
 *
 * Layout: a dropdown of saved customers + a "Walk-in" option, plus name/email
 * inputs. Picking from the dropdown auto-fills name/email and stores
 * customer_id. Choosing walk-in clears customer_id and the inputs. The user
 * can then edit name/email freely; doing so does NOT clear customer_id —
 * it's treated as an order-specific override of the customer's saved details.
 */
export function CustomerPicker({
  customerId,
  customerName,
  customerEmail,
  onChange,
}: Props) {
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("customers")
        .select("id, name, email")
        .eq("is_active", true)
        .order("name");
      setCustomers(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const handlePick = (value: string) => {
    if (value === "") {
      // Walk-in: clear FK + fields. The user can type a name freely.
      onChange({ customerId: null, customerName: "", customerEmail: "" });
      return;
    }
    const picked = customers.find((c) => c.id === value);
    if (!picked) return;
    onChange({
      customerId: picked.id,
      customerName: picked.name,
      customerEmail: picked.email ?? "",
    });
  };

  const handleNameChange = (value: string) => {
    // Manual edit — keep the FK if one was picked. The order row carries
    // the override; the customer profile is unchanged.
    onChange({
      customerId,
      customerName: value,
      customerEmail,
    });
  };

  const handleEmailChange = (value: string) => {
    onChange({
      customerId,
      customerName,
      customerEmail: value,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="customerSelect"
          className="block text-sm font-medium text-gray-700"
        >
          Customer
        </label>
        <select
          id="customerSelect"
          value={customerId ?? ""}
          onChange={(e) => handlePick(e.target.value)}
          disabled={loading}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        >
          <option value="">Walk-in (not in customer list)</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {customerId && (
          <p className="mt-1 text-xs text-gray-500">
            Linked to a saved customer. The fields below override the saved
            details on this order only.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="customerName"
            className="block text-sm font-medium text-gray-700"
          >
            Customer Name *
          </label>
          <input
            id="customerName"
            type="text"
            required
            value={customerName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g., Pike Place Market Cafe"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label
            htmlFor="customerEmail"
            className="block text-sm font-medium text-gray-700"
          >
            Customer Email
          </label>
          <input
            id="customerEmail"
            type="email"
            value={customerEmail}
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder="orders@customer.com"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
