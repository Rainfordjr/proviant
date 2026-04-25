import { createAdminClient } from "@/lib/platformAdmin";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewPlanForm } from "@/components/admin/new-plan-form";

export default async function AdminNewPlanPage() {
  const supabase = createAdminClient();

  const { data: modules } = await supabase
    .from("modules")
    .select("slug, name, is_core, price_monthly")
    .order("sort_order");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/plans"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 mb-4"
        >
          <ArrowLeft size={16} /> Back to Plans
        </Link>
        <h1 className="text-2xl font-bold text-white">Create Plan</h1>
        <p className="text-sm text-gray-500">Add a new subscription tier</p>
      </div>

      <NewPlanForm modules={modules || []} />
    </div>
  );
}
