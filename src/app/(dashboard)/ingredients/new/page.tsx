"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRequirePermission } from "@/lib/usePermission";
import { UnitSelect } from "@/components/ui/unit-select";
import { ALLERGENS } from "@/lib/constants";

export default function NewIngredientPage() {
  const { loading: permLoading } = useRequirePermission("ingredients.create");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [unit, setUnit] = useState("lbs");
  const [description, setDescription] = useState("");
  const [allergens, setAllergens] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  const toggleAllergen = (value: string) => {
    setAllergens((prev) =>
      prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("You must be logged in."); setLoading(false); return; }
    const { data: profile } = await supabase.from("users").select("org_id").eq("id", user.id).single();
    if (!profile) { setError("Could not find your organization."); setLoading(false); return; }

    const { error: insertError } = await supabase.from("ingredients").insert({
      org_id: profile.org_id,
      name,
      unit,
      description: description || null,
      allergens,
      is_active: isActive,
    });

    setLoading(false);
    if (insertError) { setError(insertError.message); return; }
    router.push("/ingredients");
    router.refresh();
  };

  if (permLoading) return <div className="p-8 text-center text-sm text-gray-500">Checking permissions…</div>;

  const labelClass = "block text-sm font-medium text-gray-700";
  const inputClass = "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/ingredients" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={16} /> Back to Ingredients
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Add Ingredient</h1>
        <p className="text-sm text-gray-500">An ingredient describes what a recipe calls for. After creating it, link one or more vendor SKUs (raw materials) to it.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <label htmlFor="name" className={labelClass}>Name *</label>
            <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. All-Purpose Flour" className={inputClass} />
          </div>

          <div>
            <label htmlFor="unit" className={labelClass}>Recipe Unit *</label>
            <UnitSelect id="unit" value={unit} onChange={setUnit} required showPlaceholder={false} className={inputClass} />
            <p className="mt-1 text-xs text-gray-500">The unit recipes will use when consuming this ingredient.</p>
          </div>

          <div>
            <label htmlFor="description" className={labelClass}>Description</label>
            <textarea id="description" rows={2} value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional spec or notes" className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Allergens (FDA Big 9)</label>
            <p className="mt-0.5 text-xs text-gray-500">All raw materials linked to this ingredient inherit this list.</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {ALLERGENS.map((a) => (
                <label key={a.value} className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={allergens.includes(a.value)}
                    onChange={() => toggleAllergen(a.value)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  {a.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              Active
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link href="/ingredients" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</Link>
          <button type="submit" disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Creating..." : "Add Ingredient"}
          </button>
        </div>
      </form>
    </div>
  );
}
