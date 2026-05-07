"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRequirePermission } from "@/lib/usePermission";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function NewDeliveryRoutePage() {
  const { loading: permLoading } = useRequirePermission("customers.edit");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [driverName, setDriverName] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  function toggleDay(day: string) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/delivery-routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || null,
        driver_name: driverName || null,
        day_of_week: selectedDays.length > 0 ? selectedDays.join(", ") : null,
        is_active: true,
      }),
    });

    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.error ?? "Failed to create route.");
      return;
    }

    router.push(`/customers/routes/${json.data.id}`);
    router.refresh();
  };

  if (permLoading) return <div className="p-8 text-center text-sm text-gray-500">Checking permissions…</div>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/customers/routes" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={16} /> Back to Delivery Routes
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Delivery Route</h1>
        <p className="text-sm text-gray-500">Create a named delivery run. You can add stops after saving.</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5 max-w-xl">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">Route Name *</label>
          <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Downtown Seattle"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
          <input id="description" type="text" value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the route area"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>

        <div>
          <label htmlFor="driver" className="block text-sm font-medium text-gray-700">Driver</label>
          <input id="driver" type="text" value={driverName} onChange={(e) => setDriverName(e.target.value)}
            placeholder="Driver name"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>

        <div>
          <span className="block text-sm font-medium text-gray-700 mb-2">Days of Week</span>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => (
              <button key={day} type="button" onClick={() => toggleDay(day)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  selectedDays.includes(day)
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                }`}>
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/customers/routes"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
          <button type="submit" disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Creating..." : "Create Route"}
          </button>
        </div>
      </form>
    </div>
  );
}
