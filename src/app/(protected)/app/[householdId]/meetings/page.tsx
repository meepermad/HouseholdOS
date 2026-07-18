import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { AppBackButton } from "@/components/app-back-button";
import { EmptyState } from "@/components/ui/empty-state";
import { previousCalendarMonth } from "@/lib/meetings/period";
import { EnsureMeetingForm } from "@/components/meetings/EnsureMeetingForm";
import { householdRoutes } from "@/lib/routes/household";
import { meetingTable } from "@/lib/meetings/client";

export const dynamic = "force-dynamic";

export default async function MeetingsDashboardPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const period = previousCalendarMonth();

  const meetingsT = await meetingTable("household_meetings");
  const actionsT = await meetingTable("household_meeting_action_items");
  const [{ data: meetings }, { data: openActions }] = await Promise.all([
    meetingsT
      .select("id, title, status, meeting_at, period_start, period_end, created_at")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false })
      .limit(20),
    actionsT
      .select("id, title, status, due_date, meeting_id")
      .eq("household_id", householdId)
      .in("status", ["open", "overdue", "needs_reassignment"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(20),
  ]);

  const list = (meetings ?? []) as Array<{
    id: string;
    title: string;
    status: string;
    period_start: string;
    period_end: string;
  }>;
  const actions = (openActions ?? []) as Array<{
    id: string;
    title: string;
    status: string;
    due_date: string | null;
  }>;

  const nextMeeting =
    list.find((m) =>
      ["draft", "preparing", "ready_for_review", "locked", "in_progress"].includes(
        m.status,
      ),
    ) ?? null;
  const past = list.filter((m) =>
    ["completed", "published", "archived"].includes(m.status),
  );

  return (
    <main className="space-y-8" data-testid="meetings-dashboard">
      <AppBackButton fallbackHref={`/app/${householdId}/ops`} />
      <header className="space-y-2">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Household meetings
        </h1>
        <p className="text-sm text-text-secondary">
          Prepare monthly reviews, run focused meetings, and track follow-up actions.
        </p>
      </header>

      <section className="space-y-3" data-testid="meetings-next">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Next meeting
        </h2>
        {nextMeeting ? (
          <div className="rounded-md border border-border bg-surface px-4 py-3">
            <p className="font-medium">{nextMeeting.title}</p>
            <p className="mt-1 text-sm text-text-secondary">
              {nextMeeting.period_start} – {nextMeeting.period_end} ·{" "}
              {nextMeeting.status.replaceAll("_", " ")}
            </p>
            <Link
              href={householdRoutes.meetings.detail(householdId, nextMeeting.id)}
              className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-2 hover:underline"
            >
              Prepare meeting
            </Link>
          </div>
        ) : (
          <div className="space-y-3 rounded-md border border-border bg-surface px-4 py-3">
            <p className="text-sm text-text-secondary">
              No open meeting. Start a monthly review for {period.label}.
            </p>
            <EnsureMeetingForm
              householdId={householdId}
              periodStart={period.start}
              periodEnd={period.end}
            />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Open action items
        </h2>
        {actions.length === 0 ? (
          <p className="text-sm text-text-muted">No open meeting actions.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {actions.map((a) => (
              <li key={a.id} className="px-4 py-3 text-sm">
                <p className="font-medium">{a.title}</p>
                <p className="text-xs text-text-muted">
                  {a.status.replaceAll("_", " ")}
                  {a.due_date ? ` · due ${a.due_date}` : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            Past meetings
          </h2>
          <Link
            href={householdRoutes.meetings.settings(householdId)}
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            Meeting settings
          </Link>
        </div>
        {past.length === 0 ? (
          <EmptyState
            variant="section"
            title="No past meetings yet"
            description="Completed monthly reviews will appear here."
          />
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {past.map((m) => (
              <li key={m.id}>
                <Link
                  href={householdRoutes.meetings.detail(householdId, m.id)}
                  className="block px-4 py-3.5 text-sm hover:bg-surface-interactive"
                >
                  <span className="font-medium">{m.title}</span>
                  <span className="mt-1 block text-xs text-text-muted">
                    {m.period_start} – {m.period_end} ·{" "}
                    {m.status.replaceAll("_", " ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
