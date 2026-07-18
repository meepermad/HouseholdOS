"use client";

import { useActionState } from "react";
import { confirmMeetingCalendarAction } from "@/app/actions/meetings";
import type { ActionResult } from "@/app/actions/auth";

export function ConfirmMeetingCalendar({
  householdId,
  meetingId,
  meetingAt,
  title,
  calendarEventId,
}: {
  householdId: string;
  meetingId: string;
  meetingAt: string | null;
  title: string;
  calendarEventId: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    confirmMeetingCalendarAction,
    null as ActionResult | null,
  );

  if (calendarEventId) {
    return (
      <p className="text-sm text-text-secondary" data-testid="meeting-calendar-linked">
        Calendar event linked.{" "}
        <a
          href={`/app/${householdId}/calendar/event/${calendarEventId}`}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Open event
        </a>
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-2" data-testid="confirm-meeting-calendar">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="meetingId" value={meetingId} />
      <input type="hidden" name="title" value={title} />
      <label className="block text-sm">
        <span className="text-text-muted">Meeting time (optional)</span>
        <input
          type="datetime-local"
          name="meetingAtLocal"
          defaultValue={
            meetingAt
              ? new Date(meetingAt).toISOString().slice(0, 16)
              : undefined
          }
          className="mt-1 w-full min-h-11 rounded-md border border-border bg-background px-3 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "Creating…" : "Add to household calendar"}
      </button>
      {state && !state.ok ? (
        <p className="text-xs text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <p className="text-xs text-text-muted">
        Creates a one-time household meeting event after you confirm. Recurring series are
        never auto-created.
      </p>
    </form>
  );
}
