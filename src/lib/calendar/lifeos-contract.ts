/**
 * LifeOS calendar integration contract (versioned, read-only by default).
 */

export const LIFEOS_CALENDAR_CONTRACT_VERSION = "1.0.0" as const;

export type LifeOsCalendarEvent = {
  contractVersion: typeof LIFEOS_CALENDAR_CONTRACT_VERSION;
  householdId: string;
  calendarId: string;
  eventId: string;
  stableUid: string;
  title: string;
  /** Visibility-safe: may be "Busy" when private */
  visibilitySafeTitle: string;
  startsAt: string | null;
  endsAt: string | null;
  startDate: string | null;
  endDateExclusive: string | null;
  allDay: boolean;
  timeZone: string;
  rrule: string | null;
  status: "scheduled" | "cancelled";
  sourceType: string | null;
  sourceId: string | null;
  deepLink: string;
  lastModified: string;
  sequence: number;
};

export type LifeOsFeedAuthorization = {
  purpose: "lifeos";
  scope: "visible_to_me" | "household_public_only";
  calendarIds: string[];
  includePrivate: boolean;
  revocable: true;
  readOnly: true;
};

export function toLifeOsEvent(params: {
  householdId: string;
  calendarId: string;
  eventId: string;
  stableUid: string;
  title: string;
  isBusyProjection: boolean;
  startsAt: string | null;
  endsAt: string | null;
  startDate: string | null;
  endDateExclusive: string | null;
  allDay: boolean;
  timeZone: string;
  rrule: string | null;
  status: "scheduled" | "cancelled";
  sourceType: string | null;
  sourceId: string | null;
  deepLink: string;
  lastModified: string;
  sequence: number;
}): LifeOsCalendarEvent {
  return {
    contractVersion: LIFEOS_CALENDAR_CONTRACT_VERSION,
    householdId: params.householdId,
    calendarId: params.calendarId,
    eventId: params.eventId,
    stableUid: params.stableUid,
    title: params.isBusyProjection ? "Busy" : params.title,
    visibilitySafeTitle: params.isBusyProjection ? "Busy" : params.title,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    startDate: params.startDate,
    endDateExclusive: params.endDateExclusive,
    allDay: params.allDay,
    timeZone: params.timeZone,
    rrule: params.isBusyProjection ? null : params.rrule,
    status: params.status,
    sourceType: params.isBusyProjection ? null : params.sourceType,
    sourceId: params.isBusyProjection ? null : params.sourceId,
    deepLink: params.deepLink,
    lastModified: params.lastModified,
    sequence: params.sequence,
  };
}
