import { createAdminClient } from "@/lib/platformAdmin";
import { ReferralManager } from "@/components/admin/referral-manager";

export default async function AdminReferralsPage() {
  const supabase = createAdminClient();

  // Fetch all referrals with org names
  const { data: referrals } = await supabase
    .from("referrals")
    .select("*, referrer_org:referrer_org_id(id, name), referred_org:referred_org_id(id, name)")
    .order("created_at", { ascending: false });

  // Fetch all orgs for the "create referral" form
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, referral_code")
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Referral Program</h1>
        <p className="text-sm text-gray-500">
          Manage referral relationships between organizations. Referrers earn credits when referred orgs make payments.
        </p>
      </div>

      <ReferralManager
        referrals={referrals || []}
        orgs={orgs || []}
      />
    </div>
  );
}
