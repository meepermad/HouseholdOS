/**
 * Minimal ICS parser for import preview (VCALENDAR / VEVENT).
 */

export type ParsedIcsEvent = {
  uid: string;
  summary: string;
  description: string | null;
  location: string | null;
  status: "CONFIRMED" | "CANCELLED" | "TENTATIVE" | "UNKNOWN";
  allDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  startDate: string | null;
  endDateExclusive: string | null;
  rrule: string | null;
  timeZone: string | null;
};

function unfold(ics: string): string {
  return ics.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function unescape(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseDateValue(
  raw: string,
  params: string,
): {
  allDay: boolean;
  instant: string | null;
  date: string | null;
  timeZone: string | null;
} {
  const tzMatch = /TZID=([^;:]+)/i.exec(params);
  const timeZone = tzMatch?.[1] ?? null;
  const value = raw.trim();
  if (/VALUE=DATE/i.test(params) || /^\d{8}$/.test(value)) {
    const ymd = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    return { allDay: true, instant: null, date: ymd, timeZone };
  }
  // 20240115T180000Z or 20240115T180000
  const m =
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(value);
  if (!m) {
    return { allDay: false, instant: null, date: null, timeZone };
  }
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] ? "Z" : ""}`;
  return {
    allDay: false,
    instant: m[7] ? iso : iso, // floating treated as local; caller applies TZ
    date: null,
    timeZone: m[7] ? "UTC" : timeZone,
  };
}

export function parseIcsEvents(icsText: string): ParsedIcsEvent[] {
  const text = unfold(icsText.replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
  const blocks = text.split(/BEGIN:VEVENT/i).slice(1);
  const events: ParsedIcsEvent[] = [];

  for (const block of blocks) {
    const body = block.split(/END:VEVENT/i)[0] ?? "";
    const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
    let uid = "";
    let summary = "Untitled";
    let description: string | null = null;
    let location: string | null = null;
    let status: ParsedIcsEvent["status"] = "UNKNOWN";
    let allDay = false;
    let startsAt: string | null = null;
    let endsAt: string | null = null;
    let startDate: string | null = null;
    let endDateExclusive: string | null = null;
    let rrule: string | null = null;
    let timeZone: string | null = null;

    for (const line of lines) {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const left = line.slice(0, idx);
      const value = line.slice(idx + 1);
      const [name, ...paramParts] = left.split(";");
      const params = paramParts.join(";");
      const key = (name ?? "").toUpperCase();

      if (key === "UID") uid = unescape(value);
      else if (key === "SUMMARY") summary = unescape(value) || "Untitled";
      else if (key === "DESCRIPTION") description = unescape(value);
      else if (key === "LOCATION") location = unescape(value);
      else if (key === "STATUS") {
        const s = value.toUpperCase();
        status =
          s === "CONFIRMED" || s === "CANCELLED" || s === "TENTATIVE"
            ? s
            : "UNKNOWN";
      } else if (key === "RRULE") rrule = value.trim();
      else if (key === "DTSTART") {
        const parsed = parseDateValue(value, params);
        allDay = parsed.allDay;
        timeZone = parsed.timeZone ?? timeZone;
        if (parsed.allDay) startDate = parsed.date;
        else startsAt = parsed.instant;
      } else if (key === "DTEND") {
        const parsed = parseDateValue(value, params);
        timeZone = parsed.timeZone ?? timeZone;
        if (parsed.allDay) endDateExclusive = parsed.date;
        else endsAt = parsed.instant;
      }
    }

    if (!uid) {
      uid = `import-${summary}-${startDate ?? startsAt ?? "unknown"}`;
    }

    events.push({
      uid,
      summary,
      description,
      location,
      status,
      allDay,
      startsAt,
      endsAt,
      startDate,
      endDateExclusive,
      rrule,
      timeZone,
    });
  }

  return events;
}

export function dedupeIcsByUid(
  events: ParsedIcsEvent[],
  existingUids: ReadonlySet<string>,
): { toImport: ParsedIcsEvent[]; skippedDuplicates: ParsedIcsEvent[] } {
  const toImport: ParsedIcsEvent[] = [];
  const skippedDuplicates: ParsedIcsEvent[] = [];
  const seen = new Set<string>();
  for (const ev of events) {
    if (existingUids.has(ev.uid) || seen.has(ev.uid)) {
      skippedDuplicates.push(ev);
      continue;
    }
    seen.add(ev.uid);
    toImport.push(ev);
  }
  return { toImport, skippedDuplicates };
}
