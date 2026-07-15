"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { GuestCountControl } from "@/components/calendar/GuestCountControl";
import { SubmitButton } from "@/components/ui/submit-button";
import { respondToCalendarEventAction } from "@/app/actions/calendar";
import type { RsvpStatus } from "@/lib/calendar/headcount";

const RSVP_OPTIONS: { value: RsvpStatus; label: string }[] = [
  { value: "going", label: "Going" },
  { value: "maybe", label: "Maybe" },
  { value: "not_going", label: "Can't go" },
];

export function RsvpControl({
  householdId,
  eventId,
  currentStatus,
  currentGuestCount = 0,
  currentGuestNote = "",
}: {
  householdId: string;
  eventId: string;
  currentStatus: RsvpStatus | null;
  currentGuestCount?: number;
  currentGuestNote?: string;
}) {
  const [status, setStatus] = useState<RsvpStatus>(
    currentStatus && currentStatus !== "needs_action" ? currentStatus : "going",
  );

  return (
    <ActionForm
      action={respondToCalendarEventAction}
      className="space-y-3"
      pendingLabel="Saving RSVP…"
    >
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="rsvpStatus" value={status} />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-primary">
          Your response
        </legend>
        <div
          className="inline-flex rounded-md border border-border bg-surface p-1"
          role="radiogroup"
          aria-label="RSVP status"
        >
          {RSVP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={status === opt.value}
              onClick={() => setStatus(opt.value)}
              className={`inline-flex min-h-11 items-center rounded px-3 py-1.5 text-sm font-medium ${
                status === opt.value
                  ? "bg-surface-interactive text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      {status !== "not_going" ? (
        <GuestCountControl
          defaultValue={currentGuestCount}
          hint="Extra guests are added to the headcount when you're going or maybe."
        />
      ) : (
        <input type="hidden" name="guestCount" value={0} />
      )}

      <label className="block text-sm font-medium text-text-primary">
        Note for the organizer (optional)
        <input
          name="guestNote"
          defaultValue={currentGuestNote}
          maxLength={240}
          className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2 text-sm"
        />
      </label>

      <SubmitButton pendingLabel="Saving RSVP…">Save RSVP</SubmitButton>
    </ActionForm>
  );
}
