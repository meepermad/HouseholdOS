import { ContinueTo } from "@/components/continue-to";
import {
  listAuthorizedHouseholdIds,
  requireUser,
  resolvePreferredHouseholdId,
} from "@/lib/household-context";

export default async function AppIndexPage() {
  const { user } = await requireUser();
  if (!user) return <ContinueTo href="/login?next=/app" />;

  const authorized = await listAuthorizedHouseholdIds(user.id);
  if (authorized.length === 0) {
    return <ContinueTo href="/onboarding" />;
  }

  const preferred = await resolvePreferredHouseholdId(user.id);
  if (!preferred) {
    // Memberships exist but none selected — show the selector (onboarding).
    return <ContinueTo href="/onboarding" />;
  }

  return <ContinueTo href={`/app/${preferred}`} />;
}
