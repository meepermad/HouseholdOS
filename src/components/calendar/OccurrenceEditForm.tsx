"use client";

import { useState } from "react";
import { updateOccurrenceAction } from "@/app/actions/calendar";
import { ActionForm } from "@/components/action-form";
import { GuestCountControl } from "@/components/calendar/GuestCountControl";
import { SubmitButton } from "@/components/ui/submit-button";
import { REMINDER_PRESETS_MINUTES } from "@/lib/calendar/reminders";

function reminderLabel(minutes: number): string {
  if (minutes === 0) return "At start";
  if (minutes < 60) return `${minutes} min before`;
  if (minutes < 1440) return `${minutes / 60} hr before`;
  if (minutes === 1440) return "1 day before";
  return `${minutes / 1440} days before`;
}

export function OccurrenceEditForm({
  householdId,
  eventId,
  originalStartsAt,
  location,
  eventGuestCount,
  reminderOffsets,
}: {
  householdId: string;
  eventId: string;
  originalStartsAt: string;
  location: string | null;
  eventGuestCount: number;
  reminderOffsets: number[];
}) {
  const [reminders, setReminders] = useState(reminderOffsets);

  function toggleReminder(offset: number) {
    setReminders((current) =>
      current.includes(offset)
        ? current.filter((item) => item !== offset)
        : [...current, offset].sort((a, b) => a - b),
    );
  }

  return (
    <ActionForm
      action={updateOccurrenceAction}
      className="mt-3 space-y-4"
      pendingLabel="Saving occurrence…"
    >
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="eventId" value={eventId} />
      <input
        type="hidden"
        name="originalStartsAt"
        value={originalStartsAt}
      />
      <input
        type="hidden"
        name="remindersJson"
        value={JSON.stringify(reminders)}
      />

      <label className="block text-sm font-medium text-text-primary">
        Location for this occurrence
        <input
          name="location"
          defaultValue={location ?? ""}
          maxLength={500}
          className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2 text-sm"
        />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm text-text-secondary">
        <input type="checkbox" name="clearLocation" />
        Inherit the series location
      </label>

      <GuestCountControl
        name="eventGuestCount"
        defaultValue={eventGuestCount}
        label="Guests for this occurrence"
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-primary">
          Reminders for this occurrence
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {REMINDER_PRESETS_MINUTES.map((offset) => (
            <label
              key={offset}
              className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm text-text-secondary"
            >
              <input
                type="checkbox"
                checked={reminders.includes(offset)}
                onChange={() => toggleReminder(offset)}
              />
              {reminderLabel(offset)}
            </label>
          ))}
        </div>
      </fieldset>

      <SubmitButton pendingLabel="Saving occurrence…">
        Save this occurrence
      </SubmitButton>
    </ActionForm>
  );
}
