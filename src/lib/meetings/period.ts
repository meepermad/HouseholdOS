/** Review-period helpers for Monthly Household Review. */

export type ReviewPeriod = {
  start: string;
  end: string;
  label: string;
};

/** Previous calendar month relative to `now`. */
export function previousCalendarMonth(now = new Date()): ReviewPeriod {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based current
  const startDate = new Date(y, m - 1, 1);
  const endDate = new Date(y, m, 0); // last day of previous month
  const start = isoDate(startDate);
  const end = isoDate(endDate);
  return {
    start,
    end,
    label: startDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
  };
}

/** Period since previous completed meeting end (exclusive) through yesterday. */
export function periodSincePreviousMeeting(
  previousMeetingEnd: string | null | undefined,
  now = new Date(),
): ReviewPeriod {
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() - 1);
  const end = isoDate(endDate);
  if (!previousMeetingEnd) {
    return previousCalendarMonth(now);
  }
  const startDate = new Date(`${previousMeetingEnd}T00:00:00`);
  startDate.setDate(startDate.getDate() + 1);
  const start = isoDate(startDate);
  if (start > end) {
    return previousCalendarMonth(now);
  }
  return {
    start,
    end,
    label: `${start} – ${end}`,
  };
}

export function comparisonPeriod(
  period: ReviewPeriod,
): { start: string; end: string } {
  const start = new Date(`${period.start}T00:00:00`);
  const end = new Date(`${period.end}T00:00:00`);
  const days =
    Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const cmpEnd = new Date(start);
  cmpEnd.setDate(cmpEnd.getDate() - 1);
  const cmpStart = new Date(cmpEnd);
  cmpStart.setDate(cmpStart.getDate() - (days - 1));
  return { start: isoDate(cmpStart), end: isoDate(cmpEnd) };
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function meetingReadiness(params: {
  sectionsReviewed: number;
  sectionsTotal: number;
  decisionsNeeded: number;
  unacknowledgedParticipants: number;
  sourceWarnings: number;
}): {
  ready: boolean;
  summaryLines: string[];
} {
  const ready =
    params.sectionsReviewed >= Math.max(1, params.sectionsTotal - 2) &&
    params.sourceWarnings === 0;
  return {
    ready,
    summaryLines: [
      ready ? "Ready" : "Needs attention before lock",
      `${params.sectionsReviewed} sections reviewed`,
      `${params.decisionsNeeded} decisions needed`,
      `${params.unacknowledgedParticipants} participants have not acknowledged the packet`,
      `${params.sourceWarnings} source-data warning${params.sourceWarnings === 1 ? "" : "s"}`,
    ],
  };
}
