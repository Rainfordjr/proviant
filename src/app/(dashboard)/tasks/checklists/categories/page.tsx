import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CategoriesManager } from "@/components/tasks/checklist-categories";

export default async function ChecklistCategoriesPage() {
  await requirePermission("checklists.edit");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", user!.id)
    .single();

  const { data: categories } = await supabase
    .from("checklist_categories")
    .select("*")
    .order("sort_order");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/tasks/checklists"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={16} /> Back to Checklists
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Checklist Categories</h1>
        <p className="text-sm text-gray-500 mt-1">Organize checklists with color-coded categories.</p>
      </div>

      <CategoriesManager
        categories={categories || []}
        orgId={profile!.org_id}
        type="checklist"
      />
    </div>
  );
}
