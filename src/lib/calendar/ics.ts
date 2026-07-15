/**
 * Standards-aligned iCalendar (RFC 5545) builder with escaping and folding.
 */

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n/g, "\\n")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\n");
}

/** Fold lines to max 75 octets (approx ASCII); soft breaks with CRLF + space. */
export function foldIcsLine(line: string): string {
  const max = 75;
  if (line.length <= max) return line;
  const parts: string[] = [];
  let remaining = line;
  parts.push(remaining.slice(0, max));
  remaining = remaining.slice(max);
  while (remaining.length > 0) {
    parts.push(` ${remaining.slice(0, max - 1)}`);
    remaining = remaining.slice(max - 1);
  }
  return parts.join("\r\n");
}

function formatUtcStamp(d: Date): string {
  const iso = d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return iso.endsWith("Z") ? iso : `${iso}Z`;
}

function formatDateOnly(date: string): string {
  return date.replace(/-/g, "");
}

export type IcsEventInput = {
  uid: string;
  sequence: number;
  lastModified: Date | string;
  summary: string;
  description?: string | null;
  location?: string | null;
  status: "CONFIRMED" | "CANCELLED" | "TENTATIVE";
  allDay: boolean;
  /** Timed */
  startsAt?: string | null;
  endsAt?: string | null;
  timeZone?: string | null;
  /** All-day exclusive end */
  startDate?: string | null;
  endDateExclusive?: string | null;
  rrule?: string | null;
  exdates?: string[]; // ISO instants or YYYY-MM-DD
  url?: string | null;
};

export function buildVevent(event: IcsEventInput): string {
  const lines: string[] = ["BEGIN:VEVENT"];
  lines.push(`UID:${escapeIcsText(event.uid)}`);
  lines.push(`SEQUENCE:${Math.max(0, event.sequence)}`);
  const lm =
    typeof event.lastModified === "string"
      ? new Date(event.lastModified)
      : event.lastModified;
  lines.push(`DTSTAMP:${formatUtcStamp(new Date())}`);
  lines.push(`LAST-MODIFIED:${formatUtcStamp(lm)}`);
  lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }
  lines.push(`STATUS:${event.status}`);
  if (event.url) {
    lines.push(`URL:${escapeIcsText(event.url)}`);
  }

  if (event.allDay) {
    if (!event.startDate || !event.endDateExclusive) {
      throw new Error("All-day ICS event requires startDate and endDateExclusive");
    }
    lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(event.startDate)}`);
    lines.push(`DTEND;VALUE=DATE:${formatDateOnly(event.endDateExclusive)}`);
  } else {
    if (!event.startsAt || !event.endsAt) {
      throw new Error("Timed ICS event requires startsAt and endsAt");
    }
    const tz = event.timeZone?.trim();
    if (tz) {
      lines.push(`DTSTART;TZID=${tz}:${formatLocalFloating(event.startsAt, tz)}`);
      lines.push(`DTEND;TZID=${tz}:${formatLocalFloating(event.endsAt, tz)}`);
    } else {
      lines.push(`DTSTART:${formatUtcStamp(new Date(event.startsAt))}`);
      lines.push(`DTEND:${formatUtcStamp(new Date(event.endsAt))}`);
    }
  }

  if (event.rrule) {
    const rule = event.rrule.trim().replace(/^RRULE:/i, "");
    lines.push(`RRULE:${rule}`);
  }
  if (event.exdates?.length) {
    for (const ex of event.exdates) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(ex)) {
        lines.push(`EXDATE;VALUE=DATE:${formatDateOnly(ex)}`);
      } else if (event.timeZone) {
        lines.push(
          `EXDATE;TZID=${event.timeZone}:${formatLocalFloating(ex, event.timeZone)}`,
        );
      } else {
        lines.push(`EXDATE:${formatUtcStamp(new Date(ex))}`);
      }
    }
  }

  lines.push("END:VEVENT");
  return lines.map(foldIcsLine).join("\r\n");
}

function formatLocalFloating(iso: string, timeZone: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}${get("month")}${get("day")}T${get("hour")}${get("minute")}${get("second")}`;
}

export function buildIcalendar(params: {
  calendarName: string;
  events: IcsEventInput[];
  productId?: string;
}): string {
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${params.productId ?? "-//HouseholdOS//Calendar//EN"}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(params.calendarName)}`,
  ];
  const body = params.events.map(buildVevent);
  const footer = ["END:VCALENDAR"];
  return [...header, ...body, ...footer].map(foldIcsLine).join("\r\n") + "\r\n";
}
