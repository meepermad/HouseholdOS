import { assertActiveMembership } from "@/lib/household-context";
import { can } from "@/lib/permissions";
import { AppBackButton } from "@/components/app-back-button";
import { AvailabilityFinder } from "@/components/calendar/AvailabilityFinder";
import { listActiveMembers } from "@/lib/calendar/queries";

export const dynamic = "force-dynamic";

export default async function CalendarAvailabilityPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const canView = can(ctx.roles, "calendar.view_availability");
  const members = await listActiveMembers(householdId);

  return (
    <div className="space-y-4">
      <AppBackButton fallbackHref={`/app/${householdId}/calendar`} />
      <header className="space-y-1">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
          Find a time
        </h1>
        <p className="text-sm text-text-secondary">
          Search household availability. Suggestions never create an event —
          you confirm before scheduling.
        </p>
      </header>
      {!canView ? (
        <p className="text-sm text-text-secondary">
          You do not have permission to view availability.
        </p>
      ) : (
        <AvailabilityFinder
          householdId={householdId}
          members={members.map((m) => ({
            membershipId: m.id,
            displayName: m.label,
          }))}
          viewerMembershipId={ctx.membershipId}
        />
      )}
    </div>
  );
}
