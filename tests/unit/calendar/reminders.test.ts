import { describe, expect, it } from "vitest";
import {
  MAX_REMINDERS_PER_EVENT,
  MAX_REMINDER_OFFSET_MINUTES,
  MIN_REMINDER_OFFSET_MINUTES,
  REMINDER_PRESETS_MINUTES,
  calendarReminderIdempotencyKey,
  reminderFireAt,
  shouldScheduleReminder,
  validateReminderOffsets,
} from "@/lib/calendar/reminders";

describe("validateReminderOffsets", () => {
  it("normalizes, deduplicates, and sorts valid offsets", () => {
    const result = validateReminderOffsets([60, 15, 15, 5]);
    expect(result).toEqual({ ok: true, offsets: [5, 15, 60] });
  });

  it("rejects too many reminders", () => {
    const offsets = [0, 5, 15, 30, 60, 120];
    const result = validateReminderOffsets(offsets);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(String(MAX_REMINDERS_PER_EVENT));
    }
  });

  it("rejects out-of-range and non-integer offsets", () => {
    expect(validateReminderOffsets([-1]).ok).toBe(false);
    expect(validateReminderOffsets([MAX_REMINDER_OFFSET_MINUTES + 1]).ok).toBe(false);
    expect(validateReminderOffsets([1.5]).ok).toBe(false);
    expect(MIN_REMINDER_OFFSET_MINUTES).toBe(0);
    expect(MAX_REMINDER_OFFSET_MINUTES).toBe(10080);
  });
});

describe("reminderFireAt", () => {
  it("schedules fire time offset minutes before occurrence start", () => {
    const occurrence = new Date("2026-06-15T14:00:00.000Z");
    const fireAt = reminderFireAt(occurrence, 30);
    expect(fireAt.toISOString()).toBe("2026-06-15T13:30:00.000Z");
  });

  it("supports at-event-time (zero offset)", () => {
    const occurrence = new Date("2026-06-15T14:00:00.000Z");
    expect(reminderFireAt(occurrence, 0).toISOString()).toBe(occurrence.toISOString());
    expect(REMINDER_PRESETS_MINUTES).toContain(0);
  });
});

describe("shouldScheduleReminder", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");

  it("returns true when fire time is in the future", () => {
    const fireAt = new Date("2026-06-15T13:00:00.000Z");
    expect(
      shouldScheduleReminder({ fireAt, now, eventCancelled: false, occurrenceCancelled: false }),
    ).toBe(true);
  });

  it("returns false when event or occurrence is cancelled", () => {
    const fireAt = new Date("2026-06-15T13:00:00.000Z");
    expect(
      shouldScheduleReminder({ fireAt, now, eventCancelled: true, occurrenceCancelled: false }),
    ).toBe(false);
    expect(
      shouldScheduleReminder({ fireAt, now, eventCancelled: false, occurrenceCancelled: true }),
    ).toBe(false);
  });

  it("returns false when fire time is far in the past", () => {
    const fireAt = new Date("2026-06-15T10:00:00.000Z");
    expect(
      shouldScheduleReminder({ fireAt, now, eventCancelled: false, occurrenceCancelled: false }),
    ).toBe(false);
  });

  it("allows ~1 minute skew for recently passed fire times", () => {
    const fireAt = new Date("2026-06-15T11:59:30.000Z");
    expect(
      shouldScheduleReminder({ fireAt, now, eventCancelled: false, occurrenceCancelled: false }),
    ).toBe(true);
  });
});

describe("calendarReminderIdempotencyKey", () => {
  it("builds a stable deduplication key from occurrence, recipient, offset, and schedule time", () => {
    const key = calendarReminderIdempotencyKey({
      occurrenceId: "occ-1",
      recipientUserId: "user-2",
      offsetMinutes: 15,
      scheduledAtIso: "2026-06-15T13:45:00.000Z",
    });
    expect(key).toBe(
      "calendar_occurrence:occ-1:user-2:calendar.reminder:15:2026-06-15T13:45:00.000Z",
    );
    expect(
      calendarReminderIdempotencyKey({
        occurrenceId: "occ-1",
        recipientUserId: "user-2",
        offsetMinutes: 15,
        scheduledAtIso: "2026-06-15T13:45:00.000Z",
      }),
    ).toBe(key);
  });

  it("differs when any dedup component changes", () => {
    const base = calendarReminderIdempotencyKey({
      occurrenceId: "occ-1",
      recipientUserId: "user-2",
      offsetMinutes: 15,
      scheduledAtIso: "2026-06-15T13:45:00.000Z",
    });
    const differentOffset = calendarReminderIdempotencyKey({
      occurrenceId: "occ-1",
      recipientUserId: "user-2",
      offsetMinutes: 30,
      scheduledAtIso: "2026-06-15T13:45:00.000Z",
    });
    expect(differentOffset).not.toBe(base);
  });
});
