/** Reminder offset presets in minutes before occurrence start. 0 = at event time. */
export const REMINDER_PRESETS_MINUTES = [
  0, // at event time
  5,
  15,
  30,
  60,
  120,
  1440, // 1 day
  10080, // 1 week
] as const;

export const MAX_REMINDERS_PER_EVENT = 5;
export const MAX_REMINDER_OFFSET_MINUTES = 10080; // 1 week
export const MIN_REMINDER_OFFSET_MINUTES = 0;

export type ReminderRecipientGroup =
  | "organizer"
  | "going"
  | "maybe"
  | "all_invited";

export type ReminderConfig = {
  offsetMinutes: number;
  recipientGroups: ReminderRecipientGroup[];
};

export function validateReminderOffsets(
  offsets: readonly number[],
): { ok: true; offsets: number[] } | { ok: false; error: string } {
  if (offsets.length > MAX_REMINDERS_PER_EVENT) {
    return {
      ok: false,
      error: `At most ${MAX_REMINDERS_PER_EVENT} reminders per event.`,
    };
  }
  const normalized: number[] = [];
  const seen = new Set<number>();
  for (const raw of offsets) {
    if (!Number.isFinite(raw) || !Number.isInteger(raw)) {
      return { ok: false, error: "Reminder offsets must be whole minutes." };
    }
    if (raw < MIN_REMINDER_OFFSET_MINUTES || raw > MAX_REMINDER_OFFSET_MINUTES) {
      return {
        ok: false,
        error: `Reminder offset must be between ${MIN_REMINDER_OFFSET_MINUTES} and ${MAX_REMINDER_OFFSET_MINUTES} minutes.`,
      };
    }
    if (seen.has(raw)) continue;
    seen.add(raw);
    normalized.push(raw);
  }
  normalized.sort((a, b) => a - b);
  return { ok: true, offsets: normalized };
}

export function reminderFireAt(
  occurrenceStartsAt: Date,
  offsetMinutes: number,
): Date {
  return new Date(occurrenceStartsAt.getTime() - offsetMinutes * 60_000);
}

export function calendarReminderIdempotencyKey(params: {
  occurrenceId: string;
  recipientUserId: string;
  offsetMinutes: number;
  scheduledAtIso: string;
}): string {
  return [
    "calendar_occurrence",
    params.occurrenceId,
    params.recipientUserId,
    "calendar.reminder",
    String(params.offsetMinutes),
    params.scheduledAtIso,
  ].join(":");
}

export function shouldScheduleReminder(params: {
  fireAt: Date;
  now?: Date;
  eventCancelled: boolean;
  occurrenceCancelled: boolean;
}): boolean {
  if (params.eventCancelled || params.occurrenceCancelled) return false;
  const now = params.now ?? new Date();
  return params.fireAt.getTime() > now.getTime() - 60_000; // allow ~1m skew
}
