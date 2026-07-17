/**
 * Recurrence series split helpers (this / this-and-future / entire).
 */

export type SeriesEditScope = "this" | "this_and_future" | "entire";

export function truncateRruleUntil(
  rrule: string,
  untilDateYmd: string,
): string {
  const until = untilDateYmd.replace(/-/g, "");
  let next = rrule;
  next = next.replace(/;?COUNT=\d+/i, "");
  if (/UNTIL=/i.test(next)) {
    next = next.replace(/UNTIL=[^;]+/i, `UNTIL=${until}`);
  } else {
    next = `${next};UNTIL=${until}`;
  }
  return next.replace(/^;/, "").replace(/;;+/g, ";");
}

export function stripRruleEnd(rrule: string): string {
  return rrule
    .replace(/;?UNTIL=[^;]+/i, "")
    .replace(/;?COUNT=\d+/i, "")
    .replace(/;;+/g, ";")
    .replace(/^;|;$/g, "");
}

/**
 * Day before split (inclusive last day of original series) in YYYY-MM-DD.
 */
export function dayBeforeIsoDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export function resolveSeriesEditScope(scope: SeriesEditScope): {
  requiresSplit: boolean;
  requiresException: boolean;
  updatesMaster: boolean;
} {
  switch (scope) {
    case "this":
      return {
        requiresSplit: false,
        requiresException: true,
        updatesMaster: false,
      };
    case "this_and_future":
      return {
        requiresSplit: true,
        requiresException: false,
        updatesMaster: true,
      };
    case "entire":
      return {
        requiresSplit: false,
        requiresException: false,
        updatesMaster: true,
      };
  }
}
