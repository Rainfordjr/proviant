"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRequirePermission } from "@/lib/usePermission";

export default function NewDevProjectPage() {
  const { loading: permLoading } = useRequirePermission("development.create");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<any[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetRecipeId, setTargetRecipeId] = useState("");

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("recipes")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      setRecipes(data || []);
    };
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("You must be logged in."); setLoading(false); return; }

    const { data: profile } = await supabase
      .from("users").select("org_id").eq("id", user.id).single();
    if (!profile) { setError("Could not find your organization."); setLoading(false); return; }

    const { data: project, error: insertError } = await supabase
      .from("dev_projects")
      .insert({
        org_id: profile.org_id,
        name,
        description: description || null,
        target_recipe_id: targetRecipeId || null,
        created_by: user.id,
      })
      .select()
      .single();

    setLoading(false);
    if (insertError) { setError(insertError.message); return; }

    router.push(`/development/${project.id}`);
    router.refresh();
  };

  if (permLoading) return <div className="p-8 text-center text-sm text-gray-500">Checking permissions…</div>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/development" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={16} /> Back to Development
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New R&D Project</h1>
        <p className="text-sm text-gray-500">Start a product development project to test new recipes or formulations</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">Project Name *</label>
          <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Gluten-Free Muffin Top Development"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
          <textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="What are you trying to achieve with this project?"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>

        <div>
          <label htmlFor="targetRecipe" className="block text-sm font-medium text-gray-700">Target Recipe (optional)</label>
          <p className="text-xs text-gray-500 mb-1">Link to an existing recipe if this is an improvement project</p>
          <select id="targetRecipe" value={targetRecipeId} onChange={(e) => setTargetRecipeId(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">None — new recipe development</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/development"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </Link>
          <button type="submit" disabled={loading}
            className="rounded-lg bg-purple-600 px-6 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
            {loading ? "Creating..." : "Create Project"}
          </button>
        </div>
      </form>
    </div>
  );
}
