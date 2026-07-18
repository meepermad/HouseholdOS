import { assertActiveMembership } from "@/lib/household-context";
import { AppBackButton } from "@/components/app-back-button";
import { householdRoutes } from "@/lib/routes/household";
import { meetingTable } from "@/lib/meetings/client";

export const dynamic = "force-dynamic";

export default async function MeetingSettingsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const prefsT = await meetingTable("household_meeting_preferences");
  const { data: prefs } = await prefsT
    .select("*")
    .eq("household_id", householdId)
    .maybeSingle();

  return (
    <main className="space-y-6" data-testid="meeting-settings">
      <AppBackButton fallbackHref={householdRoutes.meetings.index(householdId)} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Meeting settings
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Recurring preferences do not create calendar series until you confirm an event.
        </p>
      </header>
      <dl className="space-y-3 rounded-md border border-border bg-surface px-4 py-3 text-sm">
        <div>
          <dt className="text-text-muted">Recurrence</dt>
          <dd className="font-medium">
            {(prefs?.recurrence_rule as string | null) ??
              "First Sunday of each month at 6:00 PM (not scheduled yet)"}
          </dd>
        </div>
        <div>
          <dt className="text-text-muted">Auto-create calendar</dt>
          <dd className="font-medium">
            {prefs?.auto_create_calendar ? "Enabled" : "Off — confirm manually"}
          </dd>
        </div>
        <div>
          <dt className="text-text-muted">Share pairwise balances in packet</dt>
          <dd className="font-medium">
            {prefs?.share_pairwise_balances ? "Allowed by policy" : "Aggregate only"}
          </dd>
        </div>
        <div>
          <dt className="text-text-muted">Agenda rules version</dt>
          <dd className="font-medium">
            {(prefs?.agenda_rules_version as string | null) ?? "1"}
          </dd>
        </div>
      </dl>
    </main>
  );
}
