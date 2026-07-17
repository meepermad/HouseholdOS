/**
 * Deterministic availability finder.
 * Suggestions never auto-create events — the organizer must confirm.
 */

export type BusyInterval = {
  membershipId: string;
  startsAt: Date;
  endsAt: Date;
  /** When true, only busy/free is known — no private details. */
  busyOnly: boolean;
};

export type AvailabilityRuleWindow = {
  membershipId: string;
  kind: "available" | "preferred" | "unavailable" | "busy_only";
  /** ISO weekday 1=Mon … 7=Sun */
  weekdays: number[];
  startMinute: number;
  endMinute: number;
  minNoticeMinutes: number;
  maxEventMinutes: number | null;
  priority: number;
};

export type AvailabilityOverride = {
  membershipId: string;
  kind: "available" | "unavailable" | "private_block";
  startsAt: Date;
  endsAt: Date;
};

export type AvailabilitySearchInput = {
  requiredMembershipIds: string[];
  optionalMembershipIds: string[];
  rangeStart: Date;
  rangeEnd: Date;
  durationMinutes: number;
  earliestMinute: number;
  latestMinute: number;
  weekdays?: number[];
  quietHoursStartMinute?: number | null;
  quietHoursEndMinute?: number | null;
  slotStepMinutes?: number;
  busy: BusyInterval[];
  rules: AvailabilityRuleWindow[];
  overrides: AvailabilityOverride[];
  now?: Date;
};

export type CandidateWindow = {
  startsAt: Date;
  endsAt: Date;
  requiredAvailable: boolean;
  optionalAvailableCount: number;
  conflictCount: number;
  preferenceScore: number;
};

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function weekdayIso(d: Date, timeZone = "UTC"): number {
  // Use UTC parts of the Date as already zoned wall-clock when callers pass zoned instants.
  const day = d.getUTCDay(); // 0=Sun
  return day === 0 ? 7 : day;
}

function minuteOfDay(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function isInQuietHours(
  start: Date,
  end: Date,
  quietStart: number | null | undefined,
  quietEnd: number | null | undefined,
): boolean {
  if (quietStart == null || quietEnd == null) return false;
  const m = minuteOfDay(start);
  const mEnd = minuteOfDay(end);
  if (quietStart === quietEnd) return false;
  if (quietStart < quietEnd) {
    return m < quietEnd && mEnd > quietStart;
  }
  // overnight quiet window
  return m >= quietStart || mEnd <= quietEnd || m < quietEnd;
}

function memberBusyDuring(
  membershipId: string,
  start: Date,
  end: Date,
  busy: BusyInterval[],
): boolean {
  return busy.some(
    (b) =>
      b.membershipId === membershipId &&
      overlaps(start, end, b.startsAt, b.endsAt),
  );
}

function overrideBlocks(
  membershipId: string,
  start: Date,
  end: Date,
  overrides: AvailabilityOverride[],
): boolean {
  return overrides.some(
    (o) =>
      o.membershipId === membershipId &&
      (o.kind === "unavailable" || o.kind === "private_block") &&
      overlaps(start, end, o.startsAt, o.endsAt),
  );
}

function overrideAllows(
  membershipId: string,
  start: Date,
  end: Date,
  overrides: AvailabilityOverride[],
): boolean {
  return overrides.some(
    (o) =>
      o.membershipId === membershipId &&
      o.kind === "available" &&
      o.startsAt <= start &&
      o.endsAt >= end,
  );
}

function rulesAllow(
  membershipId: string,
  start: Date,
  end: Date,
  durationMinutes: number,
  rules: AvailabilityRuleWindow[],
  now: Date,
): { ok: boolean; preferred: boolean } {
  const wd = weekdayIso(start);
  const startMin = minuteOfDay(start);
  const endMin = minuteOfDay(end);
  const memberRules = rules
    .filter((r) => r.membershipId === membershipId)
    .sort((a, b) => b.priority - a.priority);

  if (memberRules.length === 0) {
    return { ok: true, preferred: false };
  }

  let blocked = false;
  let available = false;
  let preferred = false;

  for (const r of memberRules) {
    if (!r.weekdays.includes(wd)) continue;
    const covers = startMin >= r.startMinute && endMin <= r.endMinute;
    if (!covers) continue;
    if (r.maxEventMinutes != null && durationMinutes > r.maxEventMinutes) {
      blocked = true;
      continue;
    }
    const noticeMs = r.minNoticeMinutes * 60_000;
    if (start.getTime() - now.getTime() < noticeMs) {
      blocked = true;
      continue;
    }
    if (r.kind === "unavailable" || r.kind === "busy_only") {
      blocked = true;
    } else if (r.kind === "available") {
      available = true;
    } else if (r.kind === "preferred") {
      available = true;
      preferred = true;
    }
  }

  if (blocked && !available) return { ok: false, preferred: false };
  if (memberRules.some((r) => r.kind === "available" || r.kind === "preferred")) {
    return { ok: available, preferred };
  }
  return { ok: !blocked, preferred };
}

function memberAvailable(
  membershipId: string,
  start: Date,
  end: Date,
  durationMinutes: number,
  input: AvailabilitySearchInput,
  now: Date,
): { available: boolean; preferred: boolean; conflicts: number } {
  if (overrideBlocks(membershipId, start, end, input.overrides)) {
    return { available: false, preferred: false, conflicts: 1 };
  }
  if (overrideAllows(membershipId, start, end, input.overrides)) {
    const busy = memberBusyDuring(membershipId, start, end, input.busy);
    return { available: !busy, preferred: true, conflicts: busy ? 1 : 0 };
  }
  if (memberBusyDuring(membershipId, start, end, input.busy)) {
    return { available: false, preferred: false, conflicts: 1 };
  }
  const rule = rulesAllow(
    membershipId,
    start,
    end,
    durationMinutes,
    input.rules,
    now,
  );
  return {
    available: rule.ok,
    preferred: rule.preferred,
    conflicts: rule.ok ? 0 : 1,
  };
}

/**
 * Ordered by:
 * 1. All required available
 * 2. Most optional available
 * 3. Fewest conflicts
 * 4. Preference fit
 * 5. Earliest suitable time
 * 6. Start timestamp tie-breaker
 */
export function compareCandidateWindows(a: CandidateWindow, b: CandidateWindow): number {
  if (a.requiredAvailable !== b.requiredAvailable) {
    return a.requiredAvailable ? -1 : 1;
  }
  if (a.optionalAvailableCount !== b.optionalAvailableCount) {
    return b.optionalAvailableCount - a.optionalAvailableCount;
  }
  if (a.conflictCount !== b.conflictCount) {
    return a.conflictCount - b.conflictCount;
  }
  if (a.preferenceScore !== b.preferenceScore) {
    return b.preferenceScore - a.preferenceScore;
  }
  if (a.startsAt.getTime() !== b.startsAt.getTime()) {
    return a.startsAt.getTime() - b.startsAt.getTime();
  }
  return a.startsAt.getTime() - b.startsAt.getTime();
}

export function findAvailabilityWindows(
  input: AvailabilitySearchInput,
): CandidateWindow[] {
  const step = Math.max(5, input.slotStepMinutes ?? 15);
  const durationMs = input.durationMinutes * 60_000;
  const now = input.now ?? new Date();
  const weekdays = input.weekdays?.length
    ? input.weekdays
    : [1, 2, 3, 4, 5, 6, 7];
  const candidates: CandidateWindow[] = [];

  let cursor = new Date(input.rangeStart);
  // Align to step
  const align = cursor.getUTCMinutes() % step;
  if (align !== 0) {
    cursor = new Date(cursor.getTime() + (step - align) * 60_000);
  }

  while (cursor.getTime() + durationMs <= input.rangeEnd.getTime()) {
    const start = new Date(cursor);
    const end = new Date(cursor.getTime() + durationMs);
    cursor = new Date(cursor.getTime() + step * 60_000);

    const wd = weekdayIso(start);
    if (!weekdays.includes(wd)) continue;

    const startMin = minuteOfDay(start);
    const endMin = minuteOfDay(end);
    if (startMin < input.earliestMinute || endMin > input.latestMinute) continue;
    if (
      isInQuietHours(
        start,
        end,
        input.quietHoursStartMinute,
        input.quietHoursEndMinute,
      )
    ) {
      continue;
    }

    let requiredOk = true;
    let optionalCount = 0;
    let conflicts = 0;
    let preference = 0;

    for (const mid of input.requiredMembershipIds) {
      const r = memberAvailable(
        mid,
        start,
        end,
        input.durationMinutes,
        input,
        now,
      );
      if (!r.available) requiredOk = false;
      conflicts += r.conflicts;
      if (r.preferred) preference += 1;
    }
    for (const mid of input.optionalMembershipIds) {
      const r = memberAvailable(
        mid,
        start,
        end,
        input.durationMinutes,
        input,
        now,
      );
      if (r.available) optionalCount += 1;
      conflicts += r.conflicts;
      if (r.preferred) preference += 1;
    }

    candidates.push({
      startsAt: start,
      endsAt: end,
      requiredAvailable: requiredOk,
      optionalAvailableCount: optionalCount,
      conflictCount: conflicts,
      preferenceScore: preference,
    });
  }

  return candidates.sort(compareCandidateWindows);
}
