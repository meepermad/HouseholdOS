import { describe, expect, it } from "vitest";
import {
  CHORE_OCCURRENCE_SOURCE_TYPE,
  buildChoreEscalationSchedule,
  choreCoordinatorEscalationFireAt,
  choreOccurrenceIdempotencyKey,
  choreOverdueFireAt,
  choreOwnerEscalationFireAt,
  choreReminderFireAt,
} from "@/lib/chores/escalation";

describe("chore escalation", () => {
  const dueAt = new Date("2026-07-16T18:00:00.000Z");

  it("schedules assignee reminders before the due time", () => {
    expect(choreReminderFireAt(dueAt, 30).toISOString()).toBe(
      "2026-07-16T17:30:00.000Z",
    );
    expect(choreReminderFireAt(dueAt, 0).toISOString()).toBe(
      dueAt.toISOString(),
    );
  });

  it("starts overdue escalation after grace, then applies delays", () => {
    const overdueAt = choreOverdueFireAt(dueAt, 60);
    expect(overdueAt.toISOString()).toBe("2026-07-16T19:00:00.000Z");
    expect(choreOwnerEscalationFireAt(overdueAt, 120).toISOString()).toBe(
      "2026-07-16T21:00:00.000Z",
    );
    expect(
      choreCoordinatorEscalationFireAt(overdueAt, 240).toISOString(),
    ).toBe("2026-07-16T23:00:00.000Z");
  });

  it("builds a chronological schedule with an optional coordinator", () => {
    const schedule = buildChoreEscalationSchedule({
      dueAt,
      reminderOffsetsMinutes: [15, 60, 15],
      gracePeriodMinutes: 30,
      ownerDelayMinutes: 60,
      coordinatorDelayMinutes: 180,
    });
    expect(
      schedule.map((entry) => [
        entry.level,
        entry.fireAt.toISOString(),
        entry.reminderOffsetMinutes,
      ]),
    ).toEqual([
      ["assignee_reminder", "2026-07-16T17:00:00.000Z", 60],
      ["assignee_reminder", "2026-07-16T17:45:00.000Z", 15],
      ["assignee_overdue", "2026-07-16T18:30:00.000Z", undefined],
      ["creator_owner", "2026-07-16T19:30:00.000Z", undefined],
      ["coordinator", "2026-07-16T21:30:00.000Z", undefined],
    ]);
  });

  it("omits coordinator escalation when it is not configured", () => {
    const schedule = buildChoreEscalationSchedule({
      dueAt,
      gracePeriodMinutes: 0,
      ownerDelayMinutes: 60,
    });
    expect(schedule.map((entry) => entry.level)).toEqual([
      "assignee_overdue",
      "creator_owner",
    ]);
  });

  it("builds stable chore-occurrence notification keys", () => {
    expect(CHORE_OCCURRENCE_SOURCE_TYPE).toBe("chore_occurrence");
    const key = choreOccurrenceIdempotencyKey({
      occurrenceId: "occurrence-1",
      recipientUserId: "user-1",
      eventType: "chore.due_soon",
      scheduledAt: new Date("2026-07-16T17:00:00.000Z"),
    });
    expect(key).toBe(
      "chore_occurrence:occurrence-1:user-1:chore.due_soon:2026-07-16T17:00:00.000Z",
    );
    expect(
      choreOccurrenceIdempotencyKey({
        occurrenceId: "occurrence-1",
        recipientUserId: "user-1",
        eventType: "chore.due_soon",
        scheduledAt: "2026-07-16T17:00:00.000Z",
      }),
    ).toBe(key);
  });

  it("rejects negative reminder and escalation timing", () => {
    expect(() => choreReminderFireAt(dueAt, -1)).toThrow(RangeError);
    expect(() => choreOverdueFireAt(dueAt, -1)).toThrow(RangeError);
    expect(() => choreOwnerEscalationFireAt(dueAt, -1)).toThrow(
      RangeError,
    );
    expect(() => choreCoordinatorEscalationFireAt(dueAt, -1)).toThrow(
      RangeError,
    );
  });
});
