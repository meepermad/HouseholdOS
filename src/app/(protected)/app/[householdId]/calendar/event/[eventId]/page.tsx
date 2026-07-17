import Link from "next/link";
import { notFound } from "next/navigation";
import { assertActiveMembership } from "@/lib/household-context";
import { can } from "@/lib/permissions";
import { getEventDetail } from "@/lib/calendar/queries";
import { AppBackButton } from "@/components/app-back-button";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { RsvpControl } from "@/components/calendar/RsvpControl";
import { HeadcountSummary } from "@/components/calendar/HeadcountSummary";
import { cancelCalendarEventAction } from "@/app/actions/calendar";
import {
  CALENDAR_CATEGORY_LABELS,
  CALENDAR_CATEGORY_MARKS,
} from "@/lib/calendar/categories";
import { CALENDAR_VISIBILITY_LABELS } from "@/lib/calendar/visibility";
import { summarizeRrule } from "@/lib/calendar/recurrence";
import { formatEventDateTime } from "@/lib/calendar/display";
import { OccurrenceEditForm } from "@/components/calendar/OccurrenceEditForm";
import { DomainSourceBadge } from "@/components/calendar/DomainSourceBadge";
import { resolveDomainProjection } from "@/lib/calendar/domain-projections";

export const dynamic = "force-dynamic";

const RSVP_LABELS: Record<string, string> = {
  needs_action: "No reply",
  going: "Going",
  maybe: "Maybe",
  not_going: "Can't go",
};

function reminderText(minutes: number): string {
  if (minutes === 0) return "At start";
  if (minutes < 60) return `${minutes} min before`;
  if (minutes < 1440) return `${minutes / 60} hr before`;
  if (minutes === 1440) return "1 day before";
  if (minutes % 10080 === 0) return `${minutes / 10080} wk before`;
  return `${minutes / 1440} days before`;
}

export default async function CalendarEventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string; eventId: string }>;
  searchParams: Promise<{ originalStartsAt?: string }>;
}) {
  const { householdId, eventId } = await params;
  const occurrenceParams = await searchParams;
  const ctx = await assertActiveMembership(householdId);

  const event = await getEventDetail(householdId, eventId, ctx.membershipId);
  if (!event) {
    notFound();
  }

  const cancelled = event.status === "cancelled";
  const startIso = event.allDay
    ? event.startDate
      ? `${event.startDate}T00:00:00.000Z`
      : event.startsAt
    : event.startsAt;
  const endIso = event.allDay
    ? event.endDateExclusive
      ? `${event.endDateExclusive}T00:00:00.000Z`
      : event.endsAt
    : event.endsAt;

  const canOverride =
    can(ctx.roles, "calendar.coordinator_override") &&
    event.visibility === "household";
  const canManage = event.viewerIsOrganizer || canOverride;
  const isAttendee = event.attendees.some(
    (a) => a.membershipId === ctx.membershipId,
  );
  const originalStartsAt =
    occurrenceParams.originalStartsAt ??
    (!event.allDay ? event.startsAt : null);

  const projection = resolveDomainProjection(event.sourceType);
  const manageAllowed = canManage && event.isEditable && projection.editableInCalendar;

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/calendar`} />

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
          <span aria-hidden>{CALENDAR_CATEGORY_MARKS[event.category]}</span>
          <span>{CALENDAR_CATEGORY_LABELS[event.category]}</span>
          {event.sourceType ? (
            <DomainSourceBadge sourceType={event.sourceType} />
          ) : (
            <DomainSourceBadge sourceType="native" />
          )}
          {cancelled ? (
            <span className="rounded-full bg-surface-secondary px-2 py-0.5 text-xs font-medium text-text-muted">
              Cancelled
            </span>
          ) : null}
        </div>
        <h1
          className={`font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight sm:text-3xl ${
            cancelled ? "text-text-muted line-through" : ""
          }`}
        >
          {event.title}
        </h1>
        {startIso ? (
          <p className="text-sm text-text-secondary">
            {formatEventDateTime(startIso, event.timeZone, event.allDay)}
            {endIso ? (
              <>
                {" G?? "}
                {formatEventDateTime(endIso, event.timeZone, event.allDay)}
              </>
            ) : null}
          </p>
        ) : null}
        {event.rrule ? (
          <p className="text-sm text-text-muted">{summarizeRrule(event.rrule)}</p>
        ) : null}
      </header>

      {event.isBusyProjection ? (
        <p className="rounded-md border border-dashed border-border-strong bg-surface-secondary p-4 text-sm text-text-secondary">
          This time is marked <span className="font-medium">Busy</span>. The
          organizer keeps the details private.
        </p>
      ) : (
        <>
          {event.location ? (
            <p className="text-sm text-text-secondary">
              <span className="font-medium text-text-primary">Where:</span>{" "}
              {event.location}
            </p>
          ) : null}
          {event.description ? (
            <p className="whitespace-pre-line text-sm text-text-secondary">
              {event.description}
            </p>
          ) : null}

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-text-primary">
              Who&apos;s coming
            </h2>
            <HeadcountSummary
              attendees={event.attendees}
              eventGuestCount={event.eventGuestCount}
              guestLabel={event.guestLabel}
            />
          </section>

          {event.attendees.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-text-primary">
                Attendees
              </h2>
              <ul className="divide-y divide-border rounded-md border border-border bg-surface">
                {event.attendees.map((a) => (
                  <li
                    key={a.membershipId}
                    className="flex items-center justify-between px-4 py-2.5 text-sm"
                  >
                    <span className="text-text-primary">
                      {a.label}
                      {a.participationRole === "organizer" ? (
                        <span className="ml-2 text-xs text-text-muted">
                          Organizer
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {RSVP_LABELS[a.rsvpStatus] ?? a.rsvpStatus}
                      {a.guestCount > 0 ? ` +${a.guestCount}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {event.reminderOffsets.length > 0 ? (
            <section className="space-y-1">
              <h2 className="text-sm font-semibold text-text-primary">
                Reminders
              </h2>
              <p className="text-sm text-text-secondary">
                {event.reminderOffsets.map(reminderText).join(", ")}
              </p>
            </section>
          ) : null}

          {!cancelled && isAttendee ? (
            <section className="space-y-2 rounded-md border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold text-text-primary">
                Your RSVP
              </h2>
              <RsvpControl
                householdId={householdId}
                eventId={eventId}
                currentStatus={event.viewerRsvp}
                currentGuestCount={
                  event.attendees.find(
                    (a) => a.membershipId === ctx.membershipId,
                  )?.guestCount ?? 0
                }
                currentGuestNote={
                  event.attendees.find(
                    (a) => a.membershipId === ctx.membershipId,
                  )?.guestNote ?? ""
                }
              />
            </section>
          ) : null}

          {!cancelled && !projection.editableInCalendar && event.canonicalDeepLink ? (
            <section className="space-y-2 border-t border-border pt-4">
              <p className="text-sm text-text-secondary">
                {projection.readOnlyExplanation}
              </p>
              <Link
                href={event.canonicalDeepLink}
                className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-surface-interactive"
              >
                Open in {projection.label}
              </Link>
            </section>
          ) : null}

          {!cancelled && manageAllowed ? (
            <section className="space-y-3 border-t border-border pt-4">
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/app/${householdId}/calendar/event/${eventId}/edit`}
                  className="inline-flex min-h-11 items-center rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground"
                >
                  Edit event
                </Link>
              </div>

              {event.viewerIsOrganizer && originalStartsAt ? (
                <details className="rounded-md border border-border bg-surface p-4">
                  <summary className="cursor-pointer text-sm font-medium text-text-primary">
                    Edit one occurrence
                  </summary>
                  <p className="mt-2 text-xs text-text-muted">
                    Changes here apply only to the selected occurrence.
                  </p>
                  <OccurrenceEditForm
                    householdId={householdId}
                    eventId={eventId}
                    originalStartsAt={originalStartsAt}
                    location={event.location}
                    eventGuestCount={event.eventGuestCount}
                    reminderOffsets={event.reminderOffsets}
                  />
                </details>
              ) : null}

              <details className="rounded-md border border-border bg-surface p-4">
                <summary className="cursor-pointer text-sm font-medium text-destructive">
                  Cancel this event
                </summary>
                <ActionForm
                  action={cancelCalendarEventAction}
                  className="mt-3 space-y-3"
                  pendingLabel="Cancelling eventG?"
                >
                  <input type="hidden" name="householdId" value={householdId} />
                  <input type="hidden" name="eventId" value={eventId} />
                  {!event.viewerIsOrganizer && canOverride ? (
                    <input
                      type="hidden"
                      name="coordinatorOverride"
                      value="true"
                    />
                  ) : null}
                  <label className="block text-sm font-medium text-text-primary">
                    Reason (optional)
                    <input
                      name="reason"
                      maxLength={500}
                      className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2 text-sm"
                    />
                  </label>
                  <SubmitButton
                    variant="destructive"
                    pendingLabel="Cancelling eventG?"
                  >
                    Cancel event
                  </SubmitButton>
                </ActionForm>
              </details>
            </section>
          ) : null}
        </>
      )}

      <p className="text-xs text-text-muted">
        {CALENDAR_VISIBILITY_LABELS[event.visibility]} -+ Organized by{" "}
        {event.organizerLabel}
      </p>
    </main>
  );
}
