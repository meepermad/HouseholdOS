export const DEFAULT_TIMEZONE = "America/Chicago";
export const DEFAULT_CURRENCY = "USD";

/** Format an instant in the household (or default Chicago) timezone. */
export function formatInTimezone(
  date: Date | string,
  timeZone: string = DEFAULT_TIMEZONE,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(d);
}

export function nowIso(): string {
  return new Date().toISOString();
}
