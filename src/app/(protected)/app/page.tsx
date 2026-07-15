import { redirect } from "next/navigation";
import {
  listAuthorizedHouseholdIds,
  requireUser,
  resolvePreferredHouseholdId,
} from "@/lib/household-context";

export default async function AppIndexPage() {
  const { user } = await requireUser();
  if (!user) redirect("/login?next=/app");

  const authorized = await listAuthorizedHouseholdIds(user.id);
  if (authorized.length === 0) {
    redirect("/onboarding");
  }

  const preferred = await resolvePreferredHouseholdId(user.id);
  if (!preferred) {
    // Memberships exist but none selected — show the selector (onboarding).
    redirect("/onboarding");
  }

  redirect(`/app/${preferred}`);
}
