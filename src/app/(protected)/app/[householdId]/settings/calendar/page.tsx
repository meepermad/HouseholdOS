import Link from "next/link";
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
          Calendar settings
        </h1>
        <p className="text-sm text-text-secondary">
          Manage personal ICS / LifeOS feeds, download exports, and open
          external integrations. Apple Calendar refresh timing is controlled by
          Apple and may not be immediate after changes.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Subscription feeds</h2>
        <CalendarFeedManager householdId={householdId} feeds={feeds} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Export</h2>
        <p className="text-sm text-text-secondary">
          Download a one-shot <code>.ics</code> file for the next 90 days
          (authenticated; respects busy-only privacy).
        </p>
        <a
          href={`/api/calendar/export/${householdId}`}
          className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-surface-interactive"
        >
          Download .ics
        </a>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Integrations</h2>
        <Link
          href={`/app/${householdId}/settings/integrations/calendar`}
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          Google, ICS import, and LifeOS →
        </Link>
        <Link
          href={`/app/${householdId}/settings/notifications`}
          className="block text-sm text-text-secondary underline-offset-2 hover:underline"
        >
          Notification & quiet hours preferences
        </Link>
      </section>
    </main>
  );
}
