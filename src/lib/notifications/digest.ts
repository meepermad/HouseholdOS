import {
  addCalendarDays,
  getLocalParts,
  isWithinQuietHours,
  nextQuietHoursEnd,
  resolveTimeZone,
  zonedLocalToUtc,
  type QuietHoursConfig,
} from "@/lib/notifications/quiet-hours";

export const DIGEST_HOUR_LOCAL = 8;

export type DigestItem = {
  householdId: string;
  category: string;
  id: string;
};

export type DigestCategoryGroup = {
  category: string;
  items: DigestItem[];
};

export type DigestHouseholdGroup = {
  householdId: string;
  categories: DigestCategoryGroup[];
};

/**
 * Next daily digest delivery instant at DIGEST_HOUR_LOCAL in `timeZone`.
 * If that falls inside quiet hours, push forward to quiet-hours end.
 */
export function nextDigestAt(
  now: Date,
  timeZone: string,
  quietHours?: QuietHoursConfig,
): Date {
  const tz = resolveTimeZone(timeZone);
  const local = getLocalParts(now, tz);

  let day = { year: local.year, month: local.month, day: local.day };
  const pastTodaysDigest =
    local.hour > DIGEST_HOUR_LOCAL ||
    (local.hour === DIGEST_HOUR_LOCAL &&
      (local.minute > 0 || local.second > 0));

  if (pastTodaysDigest) {
    day = addCalendarDays(day.year, day.month, day.day, 1);
  }

  let candidate = zonedLocalToUtc(
    {
      year: day.year,
      month: day.month,
      day: day.day,
      hour: DIGEST_HOUR_LOCAL,
      minute: 0,
      second: 0,
    },
    tz,
  );

  if (quietHours?.enabled && isWithinQuietHours(candidate, quietHours)) {
    candidate = nextQuietHoursEnd(candidate, quietHours);
  }

  return candidate;
}

export function groupDigestItems(items: DigestItem[]): DigestHouseholdGroup[] {
  const byHousehold = new Map<string, Map<string, DigestItem[]>>();

  for (const item of items) {
    let categories = byHousehold.get(item.householdId);
    if (!categories) {
      categories = new Map();
      byHousehold.set(item.householdId, categories);
    }
    const list = categories.get(item.category) ?? [];
    list.push(item);
    categories.set(item.category, list);
  }

  return [...byHousehold.entries()].map(([householdId, categories]) => ({
    householdId,
    categories: [...categories.entries()].map(([category, grouped]) => ({
      category,
      items: grouped,
    })),
  }));
}
