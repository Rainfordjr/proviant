"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRequirePermission } from "@/lib/usePermission";
import { UnitSelect } from "@/components/ui/unit-select";
import { ALLERGENS } from "@/lib/constants";

export default function EditIngredientPage() {
  const { loading: permLoading } = useRequirePermission("ingredients.edit");
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [unit, setUnit] = useState("lbs");
  const [description, setDescription] = useState("");
  const [allergens, setAllergens] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error: e } = await supabase
        .from("ingredients").select("*").eq("id", id).single();
      if (e || !data) { setError("Ingredient not found."); setLoading(false); return; }
      setName(data.name);
      setUnit(data.unit);
      setDescription(data.description || "");
      setAllergens(data.allergens || []);
      setIsActive(data.is_active);
      setLoading(false);
    }
    load();
  }, [id]);

  const toggleAllergen = (value: string) => {
    setAllergens((prev) =>
      prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: upErr } = await supabase.from("ingredients").update({
      name,
      unit,
      description: description || null,
      allergens,
      is_active: isActive,
    }).eq("id", id);
    setSaving(false);
    if (upErr) { setError(upErr.message); return; }
    router.push(`/ingredients/${id}`);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!confirm("Delete this ingredient? Materials and recipes using it will block deletion.")) return;
    const supabase = createClient();
    const { error: delErr } = await supabase.from("ingredients").delete().eq("id", id);
    if (delErr) { setError(delErr.message); return; }
    router.push("/ingredients");
    router.refresh();
  };

  if (permLoading || loading) return <div className="p-8 text-center text-sm text-gray-500">Loading…</div>;

  const labelClass = "block text-sm font-medium text-gray-700";
  const inputClass = "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/ingredients/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={16} /> Back to Ingredient
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Ingredient</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <label htmlFor="name" className={labelClass}>Name *</label>
            <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className={inputClass} />
          </div>

          <div>
            <label htmlFor="unit" className={labelClass}>Recipe Unit *</label>
            <UnitSelect id="unit" value={unit} onChange={setUnit} required showPlaceholder={false} className={inputClass} />
          </div>

          <div>
            <label htmlFor="description" className={labelClass}>Description</label>
            <textarea id="description" rows={2} value={description}
              onChange={(e) => setDescription(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Allergens</label>
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

        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={handleDelete}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
            <Trash2 size={14} /> Delete
          </button>
          <div className="flex items-center gap-3">
            <Link href={`/ingredients/${id}`} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</Link>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
