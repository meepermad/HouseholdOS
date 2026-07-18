import Link from "next/link";
import { notFound } from "next/navigation";
import { assertActiveMembership } from "@/lib/household-context";
import { AppBackButton } from "@/components/app-back-button";
import { formatMoney } from "@/lib/expenses/display";
import { buildSharedMeetingPacket } from "@/lib/meetings/packet";
import { meetingReadiness } from "@/lib/meetings/period";
import { MeetingPrepareActions } from "@/components/meetings/MeetingPrepareActions";
import { AgendaSuggestionList } from "@/components/meetings/AgendaSuggestionList";
import { ConfirmMeetingCalendar } from "@/components/meetings/ConfirmMeetingCalendar";
import { householdRoutes } from "@/lib/routes/household";
import { MoneyCategoryBars } from "@/components/money/MoneyCategoryBars";
import { meetingTable } from "@/lib/meetings/client";

export const dynamic = "force-dynamic";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ householdId: string; meetingId: string }>;
}) {
  const { householdId, meetingId } = await params;
  const ctx = await assertActiveMembership(householdId);

  const meetingsT = await meetingTable("household_meetings");
  const { data: meeting } = await meetingsT
    .select("*")
    .eq("id", meetingId)
    .eq("household_id", householdId)
    .maybeSingle();
  if (!meeting) notFound();

  const sectionsT = await meetingTable("household_meeting_sections");
  const agendaT = await meetingTable("household_meeting_agenda_items");
  const participantsT = await meetingTable("household_meeting_participants");
  const snapshotsT = await meetingTable("household_meeting_snapshots");

  const [{ data: sections }, { data: agenda }, { data: participants }, { data: lockedSnap }] =
    await Promise.all([
      sectionsT.select("*").eq("meeting_id", meetingId).order("sort_order"),
      agendaT.select("*").eq("meeting_id", meetingId).order("sort_order"),
      participantsT
        .select("id, membership_id, role, acknowledged_packet_at")
        .eq("meeting_id", meetingId),
      snapshotsT
        .select("id, payload, created_at, packet_version_id")
        .eq("meeting_id", meetingId)
        .eq("projection", "shared")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const sectionRows = (sections ?? []) as Array<{
    id: string;
    title: string;
    included: boolean;
    informational_only: boolean;
  }>;
  const agendaRows = (agenda ?? []) as Array<{
    id: string;
    title: string;
    why_included: string | null;
    status: string;
    section_key: string;
    source: string;
  }>;
  const participantRows = (participants ?? []) as Array<{
    acknowledged_packet_at: string | null;
  }>;

  const livePreview =
    meeting.status === "locked" ||
    meeting.status === "in_progress" ||
    meeting.status === "completed" ||
    meeting.status === "published"
      ? null
      : await buildSharedMeetingPacket({
          householdId,
          membershipId: ctx.membershipId,
          period: {
            start: String(meeting.period_start),
            end: String(meeting.period_end),
            label: `${meeting.period_start} – ${meeting.period_end}`,
          },
        });

  const lockedPayload = lockedSnap?.payload as Record<string, unknown> | undefined;
  const warnings =
    (lockedPayload?.warnings as string[] | undefined) ?? livePreview?.warnings ?? [];
  const unsettledPairCount =
    (lockedPayload?.money as { unsettledPairCount?: number } | undefined)
      ?.unsettledPairCount ??
    livePreview?.money.unsettledPairCount ??
    0;
  const sharedPurchases =
    (
      lockedPayload?.money as {
        summary?: { sharedPurchasesConfirmedCents?: number };
      } | undefined
    )?.summary?.sharedPurchasesConfirmedCents ??
    livePreview?.money.summary.sharedPurchasesConfirmedCents ??
    0;

  const readiness = meetingReadiness({
    sectionsReviewed: sectionRows.filter((s) => s.included).length,
    sectionsTotal: sectionRows.length,
    decisionsNeeded: agendaRows.filter(
      (a) => a.status === "accepted" || a.status === "proposed",
    ).length,
    unacknowledgedParticipants: participantRows.filter((p) => !p.acknowledged_packet_at)
      .length,
    sourceWarnings: warnings.length,
  });

  return (
    <main className="space-y-6" data-testid="meeting-prepare">
      <AppBackButton fallbackHref={householdRoutes.meetings.index(householdId)} />
      <header className="space-y-2">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          {String(meeting.title)}
        </h1>
        <p className="text-sm text-text-secondary">
          Review period {String(meeting.period_start)} – {String(meeting.period_end)}
        </p>
        <p className="text-xs uppercase tracking-wide text-text-muted">
          Status: {String(meeting.status).replaceAll("_", " ")}
          {meeting.locked_at ? " · Locked snapshot" : " · Live preview"}
        </p>
      </header>

      <section
        className="rounded-md border border-border bg-surface px-4 py-3"
        data-testid="meeting-readiness"
      >
        <p className="font-medium">{readiness.summaryLines[0]}</p>
        <div
          className="mt-2 h-2 overflow-hidden rounded-sm bg-border/60"
          role="meter"
          aria-label="Meeting readiness"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={readiness.ready ? 100 : 55}
        >
          <div
            className="h-full bg-primary"
            style={{ width: readiness.ready ? "100%" : "55%" }}
          />
        </div>
        <ul className="mt-2 space-y-1 text-sm text-text-secondary">
          {readiness.summaryLines.slice(1).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {warnings.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm text-warning" data-testid="meeting-warnings">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="space-y-2 rounded-md border border-border bg-surface px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Calendar
        </h2>
        <ConfirmMeetingCalendar
          householdId={householdId}
          meetingId={meetingId}
          meetingAt={
            meeting.meeting_at ? String(meeting.meeting_at) : null
          }
          title={String(meeting.title)}
          calendarEventId={
            meeting.calendar_event_id ? String(meeting.calendar_event_id) : null
          }
        />
      </section>

      <MeetingPrepareActions
        householdId={householdId}
        meetingId={meetingId}
        status={String(meeting.status)}
      />

      <section className="space-y-2" data-testid="meeting-money-section">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Money
        </h2>
        <p className="text-sm">
          Confirmed shared purchases {formatMoney(sharedPurchases)}
        </p>
        <p className="text-sm text-text-secondary">
          {unsettledPairCount} member-to-member balance
          {unsettledPairCount === 1 ? "" : "s"} remain unsettled.
        </p>
        {livePreview ? (
          <>
            <MoneyCategoryBars
              categories={livePreview.money.summary.categories}
              categoryHref={livePreview.money.summary.deepLinks.category}
            />
            {livePreview.chores.completed + livePreview.chores.open > 0 ? (
              <div className="space-y-1" data-testid="meeting-chore-ratio">
                <p className="text-sm text-text-secondary">
                  Chores this period: {livePreview.chores.completed} completed,{" "}
                  {livePreview.chores.open} open
                  {livePreview.chores.overdue > 0
                    ? `, ${livePreview.chores.overdue} overdue`
                    : ""}
                </p>
                <div
                  className="h-2 overflow-hidden rounded-sm bg-border/60"
                  role="meter"
                  aria-label="Chore completion ratio"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(
                    (livePreview.chores.completed /
                      (livePreview.chores.completed + livePreview.chores.open)) *
                      100,
                  )}
                >
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${Math.round(
                        (livePreview.chores.completed /
                          (livePreview.chores.completed +
                            livePreview.chores.open)) *
                          100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Sections
        </h2>
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {sectionRows
            .filter((s) => s.included)
            .map((s) => (
              <li key={s.id} className="px-4 py-3 text-sm">
                <span className="font-medium">{s.title}</span>
                {s.informational_only ? (
                  <span className="ml-2 text-xs text-text-muted">Informational</span>
                ) : null}
              </li>
            ))}
        </ul>
      </section>

      <AgendaSuggestionList
        householdId={householdId}
        items={agendaRows.filter((a) => a.source === "suggested")}
      />

      <div className="flex flex-wrap gap-2">
        {(meeting.status === "locked" || meeting.status === "in_progress") && (
          <Link
            href={householdRoutes.meetings.run(householdId, meetingId)}
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            data-testid="open-meeting-mode"
          >
            Open meeting mode
          </Link>
        )}
        <Link
          href={householdRoutes.meetings.print(householdId, meetingId)}
          className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium"
        >
          Print / export view
        </Link>
      </div>
    </main>
  );
}
