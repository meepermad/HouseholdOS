import { assertActiveMembership } from "@/lib/household-context";
import { listFeedTokens } from "@/lib/calendar/queries";
import { CalendarFeedManager } from "@/components/calendar/CalendarFeedManager";
import { AppBackButton } from "@/components/app-back-button";

export const dynamic = "force-dynamic";

export default async function CalendarSettingsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const feeds = await listFeedTokens(ctx.userId, householdId);

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/settings/profile`} />
      <header className="space-y-1">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
          Calendar feed
        </h1>
        <p className="text-sm text-text-secondary">
          Create a private link to subscribe to household events from your
          calendar app. Feeds are read-only and can be revoked anytime.
        </p>
      </header>

      <CalendarFeedManager householdId={householdId} feeds={feeds} />
    </main>
  );
}
