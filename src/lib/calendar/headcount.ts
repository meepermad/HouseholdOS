export type RsvpStatus = "needs_action" | "going" | "maybe" | "not_going";

export type AttendeeHeadcountInput = {
  rsvpStatus: RsvpStatus;
  /** Guests this member is bringing. Counted for going/maybe only. */
  guestCount: number;
};

export type HeadcountSummary = {
  goingRoommates: number;
  maybeRoommates: number;
  notGoingRoommates: number;
  needsActionRoommates: number;
  confirmedGuests: number;
  possibleGuests: number;
  /** Going roommates + confirmed guests */
  expectedConfirmedHeadcount: number;
  /** Going + maybe roommates + all counted guests */
  possibleMaximumHeadcount: number;
};

export const MAX_GUEST_COUNT = 20;

export function normalizeGuestCount(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.floor(value), MAX_GUEST_COUNT);
}

/**
 * Deterministic headcount. Guests contribute only when RSVP is going or maybe.
 * Event-level guest_count (organizer-declared) is additive when provided.
 */
export function computeHeadcount(
  attendees: readonly AttendeeHeadcountInput[],
  eventLevelGuestCount = 0,
): HeadcountSummary {
  let goingRoommates = 0;
  let maybeRoommates = 0;
  let notGoingRoommates = 0;
  let needsActionRoommates = 0;
  let confirmedGuests = 0;
  let possibleGuests = 0;

  for (const a of attendees) {
    const guests = normalizeGuestCount(a.guestCount);
    switch (a.rsvpStatus) {
      case "going":
        goingRoommates += 1;
        confirmedGuests += guests;
        break;
      case "maybe":
        maybeRoommates += 1;
        possibleGuests += guests;
        break;
      case "not_going":
        notGoingRoommates += 1;
        break;
      default:
        needsActionRoommates += 1;
        break;
    }
  }

  const eventGuests = normalizeGuestCount(eventLevelGuestCount);
  confirmedGuests += eventGuests;

  return {
    goingRoommates,
    maybeRoommates,
    notGoingRoommates,
    needsActionRoommates,
    confirmedGuests,
    possibleGuests,
    expectedConfirmedHeadcount: goingRoommates + confirmedGuests,
    possibleMaximumHeadcount:
      goingRoommates + maybeRoommates + confirmedGuests + possibleGuests,
  };
}
