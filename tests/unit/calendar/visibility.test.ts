import { describe, expect, it } from "vitest";
import {
  BUSY_BLOCK_TITLE,
  CALENDAR_VISIBILITIES,
  projectEventForViewer,
  resolveEventProjection,
} from "@/lib/calendar/visibility";

const organizer = "org-111";
const attendee = "att-333";
const outsider = "out-444";

const baseEvent = {
  id: "evt-1",
  title: "Secret dinner",
  description: "Bring wine",
  location: "123 Oak St",
  guest_label: "Plus ones",
  event_guest_count: 2,
  visibility: "private_busy" as const,
  organizer_membership_id: organizer,
};

describe("resolveEventProjection", () => {
  it("grants full access to organizer and attendees", () => {
    expect(
      resolveEventProjection({
        visibility: "private_busy",
        viewerMembershipId: organizer,
        organizerMembershipId: organizer,
        attendeeMembershipIds: [attendee],
      }),
    ).toBe("full");

    expect(
      resolveEventProjection({
        visibility: "private_busy",
        viewerMembershipId: attendee,
        organizerMembershipId: organizer,
        attendeeMembershipIds: [attendee],
      }),
    ).toBe("full");
  });

  it("shows household events in full to any viewer", () => {
    expect(
      resolveEventProjection({
        visibility: "household",
        viewerMembershipId: outsider,
        organizerMembershipId: organizer,
        attendeeMembershipIds: [attendee],
      }),
    ).toBe("full");
  });

  it("projects private_busy as busy for non-participants", () => {
    expect(
      resolveEventProjection({
        visibility: "private_busy",
        viewerMembershipId: outsider,
        organizerMembershipId: organizer,
        attendeeMembershipIds: [attendee],
      }),
    ).toBe("busy");
  });

  it("hides participants-only events from outsiders", () => {
    expect(
      resolveEventProjection({
        visibility: "participants",
        viewerMembershipId: outsider,
        organizerMembershipId: organizer,
        attendeeMembershipIds: [attendee],
      }),
    ).toBe("hidden");
  });
});

describe("projectEventForViewer", () => {
  it("returns null for hidden projection", () => {
    expect(
      projectEventForViewer({ event: baseEvent, mode: "hidden" }),
    ).toBeNull();
  });

  it("returns the event unchanged for full projection", () => {
    const projected = projectEventForViewer({ event: baseEvent, mode: "full" });
    expect(projected).toEqual(baseEvent);
  });

  it("redacts private event details into a busy block", () => {
    const projected = projectEventForViewer({ event: baseEvent, mode: "busy" });
    expect(projected).toMatchObject({
      title: BUSY_BLOCK_TITLE,
      description: null,
      location: null,
      guest_label: null,
      event_guest_count: null,
      is_busy_projection: true,
    });
    expect(projected?.id).toBe("evt-1");
    expect(BUSY_BLOCK_TITLE).toBe("Busy");
  });
});

describe("visibility constants", () => {
  it("exposes supported calendar visibilities", () => {
    expect(CALENDAR_VISIBILITIES).toContain("private_busy");
    expect(CALENDAR_VISIBILITIES).toContain("household");
    expect(CALENDAR_VISIBILITIES).toContain("participants");
  });
});
