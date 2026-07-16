import type { PantryState } from "./types";

export type PantryDateInput = {
  /** ISO date YYYY-MM-DD or Date */
  bestBy?: string | Date | null;
  useBy?: string | Date | null;
  useSoon?: string | Date | null;
  /** Reference "today" for tests */
  asOf?: string | Date;
};

function toDateOnly(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) throw new Error(`Invalid date: ${value}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function startOfToday(asOf?: string | Date): Date {
  if (asOf) return toDateOnly(asOf);
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/**
 * True when an entered use-by or best-by date is on or before asOf.
 * Does NOT assert food is unsafe — UI must say "Past entered date / Review before use".
 */
export function isEnteredDatePassed(input: PantryDateInput): boolean {
  const today = startOfToday(input.asOf);
  const candidates = [input.useBy, input.bestBy].filter(Boolean) as (
    | string
    | Date
  )[];
  for (const c of candidates) {
    if (toDateOnly(c).getTime() <= today.getTime()) return true;
  }
  return false;
}

export function isUseSoon(input: PantryDateInput): boolean {
  if (!input.useSoon) return false;
  const today = startOfToday(input.asOf);
  return toDateOnly(input.useSoon).getTime() <= today.getTime();
}

export function classifyPantryDateState(input: PantryDateInput): {
  datePassed: boolean;
  useSoon: boolean;
  /** Safe UI copy — never medical/food-safety claims */
  reviewLabel: string | null;
} {
  const datePassed = isEnteredDatePassed(input);
  const useSoon = !datePassed && isUseSoon(input);
  let reviewLabel: string | null = null;
  if (datePassed) {
    reviewLabel = "Past entered date · Review before use";
  } else if (useSoon) {
    reviewLabel = "Use soon · Review before use";
  }
  return { datePassed, useSoon, reviewLabel };
}

export function pantryStateFromDates(
  input: PantryDateInput & { current?: PantryState },
): PantryState {
  if (
    input.current === "finished" ||
    input.current === "discarded"
  ) {
    return input.current;
  }
  const { datePassed, useSoon } = classifyPantryDateState(input);
  if (datePassed) return "expired";
  if (useSoon) return "use_soon";
  return input.current ?? "available";
}

/** Reminder fire date for use-soon / entered date (morning of that day). */
export function pantryReminderScheduledAt(params: {
  date: string | Date;
  timeZone?: string;
}): Date {
  const d = toDateOnly(params.date);
  // Store as UTC noon to avoid DST edge when worker applies TZ — matches chore pattern loosely
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0),
  );
}
