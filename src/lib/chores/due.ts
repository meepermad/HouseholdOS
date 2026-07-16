import {
  isValidIanaTimeZone,
  zonedWallClockToUtc,
} from "@/lib/calendar/time-mode";

export type ChoreDueInput = {
  dueDate: string;
  dueTime?: string;
  timeZone: string;
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

function requireNonNegativeMinutes(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative number.`);
  }
}

export function calculateDueTimestamp(input: ChoreDueInput): Date {
  const dateMatch = DATE_PATTERN.exec(input.dueDate);
  const timeMatch = TIME_PATTERN.exec(input.dueTime ?? "23:59");
  if (!dateMatch || !timeMatch) {
    throw new RangeError("Due date and time must use YYYY-MM-DD and HH:mm formats.");
  }
  if (!isValidIanaTimeZone(input.timeZone)) {
    throw new RangeError("Invalid timezone.");
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() !== month - 1 ||
    calendarCheck.getUTCDate() !== day
  ) {
    throw new RangeError("Invalid due date.");
  }

  return zonedWallClockToUtc(
    {
      year,
      month,
      day,
      hour: Number(timeMatch[1]),
      minute: Number(timeMatch[2]),
      second: Number(timeMatch[3] ?? 0),
    },
    input.timeZone,
  );
}

export function gracePeriodEndsAt(
  dueAt: Date,
  gracePeriodMinutes: number,
): Date {
  requireNonNegativeMinutes(gracePeriodMinutes, "Grace period");
  return new Date(dueAt.getTime() + gracePeriodMinutes * 60_000);
}

export function isChoreOverdue(params: {
  dueAt: Date;
  gracePeriodMinutes?: number;
  now?: Date;
}): boolean {
  const graceEnd = gracePeriodEndsAt(
    params.dueAt,
    params.gracePeriodMinutes ?? 0,
  );
  return (params.now ?? new Date()).getTime() >= graceEnd.getTime();
}
