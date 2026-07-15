import { describe, expect, it } from "vitest";
import {
  MAX_GUEST_COUNT,
  computeHeadcount,
  normalizeGuestCount,
} from "@/lib/calendar/headcount";

describe("normalizeGuestCount", () => {
  it("clamps negative and non-finite values to zero", () => {
    expect(normalizeGuestCount(-1)).toBe(0);
    expect(normalizeGuestCount(Number.NaN)).toBe(0);
    expect(normalizeGuestCount(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("floors fractional guest counts", () => {
    expect(normalizeGuestCount(2.9)).toBe(2);
  });

  it("caps guest count at MAX_GUEST_COUNT", () => {
    expect(normalizeGuestCount(25)).toBe(MAX_GUEST_COUNT);
    expect(MAX_GUEST_COUNT).toBe(20);
  });
});

describe("computeHeadcount", () => {
  it("counts going roommates and their guests toward confirmed headcount", () => {
    const summary = computeHeadcount([
      { rsvpStatus: "going", guestCount: 2 },
      { rsvpStatus: "going", guestCount: 1 },
    ]);
    expect(summary.goingRoommates).toBe(2);
    expect(summary.confirmedGuests).toBe(3);
    expect(summary.expectedConfirmedHeadcount).toBe(5); // 2 going + 3 guests
    expect(summary.possibleMaximumHeadcount).toBe(5);
  });

  it("counts maybe roommates and guests toward possible maximum only", () => {
    const summary = computeHeadcount([
      { rsvpStatus: "going", guestCount: 0 },
      { rsvpStatus: "maybe", guestCount: 3 },
      { rsvpStatus: "not_going", guestCount: 5 },
      { rsvpStatus: "needs_action", guestCount: 10 },
    ]);
    expect(summary.goingRoommates).toBe(1);
    expect(summary.maybeRoommates).toBe(1);
    expect(summary.notGoingRoommates).toBe(1);
    expect(summary.needsActionRoommates).toBe(1);
    expect(summary.confirmedGuests).toBe(0);
    expect(summary.possibleGuests).toBe(3);
    expect(summary.expectedConfirmedHeadcount).toBe(1);
    expect(summary.possibleMaximumHeadcount).toBe(5); // 1 going + 1 maybe + 3 maybe guests
  });

  it("adds event-level guest count to confirmed guests", () => {
    const summary = computeHeadcount(
      [{ rsvpStatus: "going", guestCount: 1 }],
      4,
    );
    expect(summary.confirmedGuests).toBe(5); // 1 attendee guest + 4 event guests
    expect(summary.expectedConfirmedHeadcount).toBe(6); // 1 going + 5 guests
  });

  it("ignores guest counts for not_going and needs_action", () => {
    const summary = computeHeadcount([
      { rsvpStatus: "not_going", guestCount: 10 },
      { rsvpStatus: "needs_action", guestCount: 10 },
    ]);
    expect(summary.confirmedGuests).toBe(0);
    expect(summary.possibleGuests).toBe(0);
  });

  it("normalizes out-of-bounds guest counts in aggregation", () => {
    const summary = computeHeadcount(
      [
        { rsvpStatus: "going", guestCount: 100 },
        { rsvpStatus: "maybe", guestCount: -5 },
      ],
      50,
    );
    expect(summary.confirmedGuests).toBe(MAX_GUEST_COUNT + MAX_GUEST_COUNT);
    expect(summary.possibleGuests).toBe(0);
  });
});
