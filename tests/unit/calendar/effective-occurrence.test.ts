import { describe, expect, it } from "vitest";
import { mergeOccurrenceMetadata } from "@/lib/calendar/effective-occurrence";

const master = {
  title: "Family dinner",
  description: "Sunday meal",
  location: "Home",
  eventGuestCount: 1,
  guestLabel: "Friends",
};

describe("mergeOccurrenceMetadata", () => {
  it("supports a guest-only metadata override", () => {
    const result = mergeOccurrenceMetadata(master, {
      kind: "override",
      eventGuestCount: 4,
      guestLabel: "Visiting family",
    });

    expect(result).toMatchObject({
      title: master.title,
      description: master.description,
      location: master.location,
      eventGuestCount: 4,
      guestLabel: "Visiting family",
      cancelled: false,
    });
  });

  it("inherits the master location when an override omits it", () => {
    const result = mergeOccurrenceMetadata(master, {
      kind: "override",
      eventGuestCount: 2,
    });
    expect(result.location).toBe("Home");
  });

  it("marks cancelled occurrences and suppresses their reminders", () => {
    const result = mergeOccurrenceMetadata(
      master,
      { kind: "cancelled" },
      [15, 60],
      ["member-1"],
    );
    expect(result.cancelled).toBe(true);
    expect(result.reminderOffsets).toEqual([]);
    expect(result.attendeeMembershipIds).toEqual(["member-1"]);
  });
});
