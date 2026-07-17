import {
  computeHeadcount,
  normalizeGuestCount,
  type AttendeeHeadcountInput,
  type HeadcountSummary,
} from "@/lib/calendar/headcount";

export type ServingEstimateInput = {
  attendees: readonly AttendeeHeadcountInput[];
  /** Organizer-declared guests not tied to a specific member. */
  eventGuestCount?: number;
  /** Whether maybe attendees count toward recommended minimum. */
  includeMaybeInMinimum?: boolean;
  bufferServings?: number;
  desiredLeftoverServings?: number;
  /** Organizer override; if omitted, recommended minimum is used. */
  organizerTarget?: number;
};

export type ServingEstimate = {
  headcount: HeadcountSummary;
  confirmedPeople: number;
  possibleAdditionalPeople: number;
  bufferServings: number;
  desiredLeftoverServings: number;
  recommendedMinimum: number;
  possibleMaximum: number;
  organizerTarget: number;
};

function nonNegInt(value: number | undefined, fallback = 0): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) return fallback;
  return Math.floor(value);
}

/**
 * Deterministic serving estimate. Organizer chooses final target.
 * Does not assign portions to individuals.
 */
export function estimateServings(input: ServingEstimateInput): ServingEstimate {
  const headcount = computeHeadcount(
    input.attendees,
    normalizeGuestCount(input.eventGuestCount ?? 0),
  );
  const buffer = nonNegInt(input.bufferServings);
  const leftovers = nonNegInt(input.desiredLeftoverServings);
  const includeMaybe = input.includeMaybeInMinimum === true;

  const confirmedPeople = headcount.expectedConfirmedHeadcount;
  const possibleAdditionalPeople =
    headcount.maybeRoommates + headcount.possibleGuests;

  const recommendedMinimum =
    confirmedPeople +
    (includeMaybe ? possibleAdditionalPeople : 0) +
    buffer +
    leftovers;

  const possibleMaximum =
    headcount.possibleMaximumHeadcount + buffer + leftovers;

  const minFloor = Math.max(1, recommendedMinimum);
  const organizerTarget =
    input.organizerTarget !== undefined &&
    Number.isFinite(input.organizerTarget) &&
    input.organizerTarget > 0
      ? Math.floor(input.organizerTarget)
      : minFloor;

  return {
    headcount,
    confirmedPeople,
    possibleAdditionalPeople,
    bufferServings: buffer,
    desiredLeftoverServings: leftovers,
    recommendedMinimum: minFloor,
    possibleMaximum: Math.max(minFloor, possibleMaximum),
    organizerTarget,
  };
}
