import { redirect } from "next/navigation";

// Plans are now managed at the platform level.
// Redirect to the plans page.
export default function NewPlanRedirect() {
  redirect("/settings/plans");
}
