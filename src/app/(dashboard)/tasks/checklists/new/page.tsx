import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ChecklistForm } from "@/components/tasks/checklist-form";

export default async function NewChecklistPage() {
  await requirePermission("checklists.create");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("id, org_id")
    .eq("id", user!.id)
    .single();

  // Fetch categories for the form
  const { data: categories } = await supabase
    .from("checklist_categories")
    .select("id, name, color")
    .eq("is_active", true)
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
        <h1 className="text-2xl font-bold text-gray-900">New Checklist</h1>
        <p className="text-sm text-gray-500">Create a reusable checklist template with versioned items</p>
      </div>

      <ChecklistForm
        orgId={profile!.org_id}
        currentUserId={profile!.id}
        categories={categories || []}
      />
    </div>
  );
}
