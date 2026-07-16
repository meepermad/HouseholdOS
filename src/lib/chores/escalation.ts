import { gracePeriodEndsAt } from "./due";
import type { ChoreEscalationLevel } from "./types";

export const CHORE_OCCURRENCE_SOURCE_TYPE = "chore_occurrence" as const;

export type ChoreEscalationScheduleEntry = {
  level: ChoreEscalationLevel;
  fireAt: Date;
  reminderOffsetMinutes?: number;
};

function requireNonNegativeMinutes(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative number.`);
  }
}

export function choreReminderFireAt(
  dueAt: Date,
  offsetMinutes: number,
): Date {
  requireNonNegativeMinutes(offsetMinutes, "Reminder offset");
  return new Date(dueAt.getTime() - offsetMinutes * 60_000);
}

export function choreOverdueFireAt(
  dueAt: Date,
  gracePeriodMinutes: number,
): Date {
  return gracePeriodEndsAt(dueAt, gracePeriodMinutes);
}

export function choreOwnerEscalationFireAt(
  overdueAt: Date,
  delayMinutes: number,
): Date {
  requireNonNegativeMinutes(delayMinutes, "Owner escalation delay");
  return new Date(overdueAt.getTime() + delayMinutes * 60_000);
}

export function choreCoordinatorEscalationFireAt(
  overdueAt: Date,
  delayMinutes: number,
): Date {
  requireNonNegativeMinutes(delayMinutes, "Coordinator escalation delay");
  return new Date(overdueAt.getTime() + delayMinutes * 60_000);
}

export function buildChoreEscalationSchedule(params: {
  dueAt: Date;
  reminderOffsetsMinutes?: readonly number[];
  gracePeriodMinutes: number;
  ownerDelayMinutes: number;
  coordinatorDelayMinutes?: number | null;
}): ChoreEscalationScheduleEntry[] {
  const reminderOffsets = Array.from(
    new Set(params.reminderOffsetsMinutes ?? []),
  );
  const overdueAt = choreOverdueFireAt(
    params.dueAt,
    params.gracePeriodMinutes,
  );
  const schedule: ChoreEscalationScheduleEntry[] = reminderOffsets.map(
    (offsetMinutes) => ({
      level: "assignee_reminder",
      fireAt: choreReminderFireAt(params.dueAt, offsetMinutes),
      reminderOffsetMinutes: offsetMinutes,
    }),
  );

  schedule.push(
    { level: "assignee_overdue", fireAt: overdueAt },
    {
      level: "creator_owner",
      fireAt: choreOwnerEscalationFireAt(
        overdueAt,
        params.ownerDelayMinutes,
      ),
    },
  );
  if (params.coordinatorDelayMinutes != null) {
    schedule.push({
      level: "coordinator",
      fireAt: choreCoordinatorEscalationFireAt(
        overdueAt,
        params.coordinatorDelayMinutes,
      ),
    });
  }

  return schedule.sort((a, b) => {
    const timeDifference = a.fireAt.getTime() - b.fireAt.getTime();
    return timeDifference || a.level.localeCompare(b.level);
  });
}

export function choreOccurrenceIdempotencyKey(params: {
  occurrenceId: string;
  recipientUserId: string;
  eventType: string;
  scheduledAt: Date | string;
}): string {
  const scheduledAt =
    typeof params.scheduledAt === "string"
      ? params.scheduledAt
      : params.scheduledAt.toISOString();
  return [
    CHORE_OCCURRENCE_SOURCE_TYPE,
    params.occurrenceId,
    params.recipientUserId,
    params.eventType,
    scheduledAt,
  ].join(":");
}
