import { describe, expect, it } from "vitest";
import {
  compareCandidateWindows,
  findAvailabilityWindows,
  type CandidateWindow,
} from "@/lib/calendar/availability";
import {
  canProceedWithConflicts,
  detectParticipantConflicts,
  detectResourceConflicts,
} from "@/lib/calendar/conflicts";
import {
  invalidateRsvpAfterMaterialChange,
  isMaterialEventChange,
} from "@/lib/calendar/rsvp-reconfirm";
import {
  dayBeforeIsoDate,
  resolveSeriesEditScope,
  stripRruleEnd,
  truncateRruleUntil,
} from "@/lib/calendar/series-split";
import { dedupeIcsByUid, parseIcsEvents } from "@/lib/calendar/ics-parse";
import {
  autoResolutionFor,
  classifySyncConflict,
  isEchoLoop,
  materialSyncFieldsChanged,
  syncBackoffMs,
} from "@/lib/calendar/external/sync-conflict";
import { sealSecret, unsealSecret } from "@/lib/calendar/external/token-seal";
import { createMockGoogleProvider } from "@/lib/calendar/external/google";
import {
  LIFEOS_CALENDAR_CONTRACT_VERSION,
  toLifeOsEvent,
} from "@/lib/calendar/lifeos-contract";
import { resolveDomainProjection } from "@/lib/calendar/domain-projections";
import { privacySafeFinanceTitle } from "@/lib/calendar/domain-reminder-projections";
import { buildIcalendar } from "@/lib/calendar/ics";

describe("rsvp reconfirmation", () => {
  it("detects material time and location changes", () => {
    expect(
      isMaterialEventChange(
        {
          allDay: false,
          startsAt: "2026-07-01T18:00:00.000Z",
          endsAt: "2026-07-01T19:00:00.000Z",
          startDate: null,
          endDateExclusive: null,
          location: "Kitchen",
        },
        {
          allDay: false,
          startsAt: "2026-07-01T19:00:00.000Z",
          endsAt: "2026-07-01T20:00:00.000Z",
          startDate: null,
          endDateExclusive: null,
          location: "Kitchen",
        },
      ),
    ).toBe(true);
  });

  it("invalidates going RSVPs after material change", () => {
    expect(
      invalidateRsvpAfterMaterialChange({
        participationRole: "invitee",
        currentStatus: "going",
      }),
    ).toEqual({ status: "needs_action", needsReconfirmation: true });
  });
});

describe("availability ordering", () => {
  it("orders by required → optional → conflicts → preference → earliest", () => {
    const a: CandidateWindow = {
      startsAt: new Date("2026-07-02T15:00:00Z"),
      endsAt: new Date("2026-07-02T16:00:00Z"),
      requiredAvailable: true,
      optionalAvailableCount: 1,
      conflictCount: 0,
      preferenceScore: 0,
    };
    const b: CandidateWindow = {
      startsAt: new Date("2026-07-02T14:00:00Z"),
      endsAt: new Date("2026-07-02T15:00:00Z"),
      requiredAvailable: true,
      optionalAvailableCount: 2,
      conflictCount: 0,
      preferenceScore: 0,
    };
    expect(compareCandidateWindows(b, a)).toBeLessThan(0);
  });

  it("finds windows where required members are free", () => {
    const windows = findAvailabilityWindows({
      requiredMembershipIds: ["m1"],
      optionalMembershipIds: [],
      rangeStart: new Date("2026-07-01T14:00:00Z"),
      rangeEnd: new Date("2026-07-01T18:00:00Z"),
      durationMinutes: 60,
      earliestMinute: 0,
      latestMinute: 1440,
      busy: [
        {
          membershipId: "m1",
          startsAt: new Date("2026-07-01T15:00:00Z"),
          endsAt: new Date("2026-07-01T16:00:00Z"),
          busyOnly: true,
        },
      ],
      rules: [],
      overrides: [],
      now: new Date("2026-06-01T00:00:00Z"),
    });
    expect(windows.some((w) => w.requiredAvailable)).toBe(true);
    expect(
      windows
        .filter((w) => w.requiredAvailable)
        .every(
          (w) =>
            !(
              w.startsAt < new Date("2026-07-01T16:00:00Z") &&
              w.endsAt > new Date("2026-07-01T15:00:00Z")
            ),
        ),
    ).toBe(true);
  });
});

describe("conflicts", () => {
  it("detects participant overlaps and blocks hard resource conflicts", () => {
    const conflicts = detectParticipantConflicts(
      {
        id: "e1",
        startsAt: new Date("2026-07-01T18:00:00Z"),
        endsAt: new Date("2026-07-01T19:00:00Z"),
        membershipIds: ["a", "b"],
        titleVisible: true,
        title: "Dinner",
      },
      [
        {
          id: "e2",
          startsAt: new Date("2026-07-01T18:30:00Z"),
          endsAt: new Date("2026-07-01T19:30:00Z"),
          membershipIds: ["b"],
          titleVisible: false,
        },
      ],
    );
    expect(conflicts[0]?.conflictKind).toBe("participant_overlap");
    expect(canProceedWithConflicts(conflicts)).toBe(true);

    const hard = detectResourceConflicts(
      "e1",
      [
        {
          resourceId: "car",
          eventId: "e1",
          quantity: 1,
          capacityMode: "exclusive",
          capacity: 1,
          startsAt: new Date("2026-07-01T18:00:00Z"),
          endsAt: new Date("2026-07-01T19:00:00Z"),
        },
      ],
      [
        {
          resourceId: "car",
          eventId: "e2",
          quantity: 1,
          capacityMode: "exclusive",
          capacity: 1,
          startsAt: new Date("2026-07-01T18:30:00Z"),
          endsAt: new Date("2026-07-01T19:30:00Z"),
        },
      ],
    );
    expect(hard[0]?.conflictClass).toBe("hard");
    expect(canProceedWithConflicts(hard)).toBe(false);
  });
});

describe("series split", () => {
  it("supports this / this_and_future / entire scopes", () => {
    expect(resolveSeriesEditScope("this").requiresException).toBe(true);
    expect(resolveSeriesEditScope("this_and_future").requiresSplit).toBe(true);
    expect(resolveSeriesEditScope("entire").updatesMaster).toBe(true);
    expect(truncateRruleUntil("FREQ=WEEKLY;COUNT=10", "2026-08-01")).toContain(
      "UNTIL=20260801",
    );
    expect(stripRruleEnd("FREQ=DAILY;UNTIL=20260801")).toBe("FREQ=DAILY");
    expect(dayBeforeIsoDate("2026-07-02")).toBe("2026-07-01");
  });
});

describe("ics parse and serialize", () => {
  it("parses events and dedupes by uid", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:abc-123
SUMMARY:Test
DTSTART:20260701T180000Z
DTEND:20260701T190000Z
END:VEVENT
END:VCALENDAR`;
    const parsed = parseIcsEvents(ics);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.uid).toBe("abc-123");
    const { toImport, skippedDuplicates } = dedupeIcsByUid(
      parsed,
      new Set(["abc-123"]),
    );
    expect(toImport).toHaveLength(0);
    expect(skippedDuplicates).toHaveLength(1);

    const out = buildIcalendar({
      calendarName: "Test",
      events: [
        {
          uid: "abc-123",
          sequence: 0,
          lastModified: new Date("2026-07-01T00:00:00Z"),
          summary: "Test",
          status: "CONFIRMED",
          allDay: false,
          startsAt: "2026-07-01T18:00:00.000Z",
          endsAt: "2026-07-01T19:00:00.000Z",
          timeZone: "UTC",
        },
      ],
    });
    expect(out).toContain("UID:abc-123");
  });
});

describe("sync conflict policy", () => {
  it("requires review when both sides change", () => {
    const type = classifySyncConflict({
      localChangedSinceSync: true,
      providerChangedSinceSync: true,
      localDeleted: false,
      providerDeleted: false,
    });
    expect(type).toBe("both_changed");
    expect(autoResolutionFor(type!)).toBe("pending");
  });

  it("auto-applies provider-only changes", () => {
    expect(
      autoResolutionFor(
        classifySyncConflict({
          localChangedSinceSync: false,
          providerChangedSinceSync: true,
          localDeleted: false,
          providerDeleted: false,
        })!,
      ),
    ).toBe("keep_provider");
  });

  it("detects echo loops and material field changes", () => {
    expect(
      isEchoLoop({
        lastExportedProviderVersion: "etag-1",
        incomingProviderVersion: "etag-1",
      }),
    ).toBe(true);
    expect(
      materialSyncFieldsChanged(
        {
          title: "A",
          startsAt: "1",
          endsAt: "2",
          location: null,
          cancelled: false,
        },
        {
          title: "B",
          startsAt: "1",
          endsAt: "2",
          location: null,
          cancelled: false,
        },
      ),
    ).toBe(true);
    expect(syncBackoffMs(1)).toBeGreaterThanOrEqual(60_000);
  });
});

describe("token seal", () => {
  it("round-trips sealed secrets", () => {
    const key = "phase9-calendar-token-encryption-key!!";
    const sealed = sealSecret("refresh-token-value", key);
    expect(unsealSecret(sealed.ciphertext, sealed.nonce, key)).toBe(
      "refresh-token-value",
    );
  });
});

describe("google mock provider", () => {
  it("lists and upserts events", async () => {
    const provider = createMockGoogleProvider([
      { id: "1", summary: "Existing" },
    ]);
    const listed = await provider.listEvents({
      accessToken: "x",
      calendarId: "primary",
    });
    expect(listed.events).toHaveLength(1);
    const created = await provider.upsertEvent({
      accessToken: "x",
      calendarId: "primary",
      event: { summary: "New" },
    });
    expect(created.id).toBeTruthy();
  });
});

describe("lifeos + domain projections", () => {
  it("builds visibility-safe LifeOS events", () => {
    const ev = toLifeOsEvent({
      householdId: "h",
      calendarId: "c",
      eventId: "e",
      stableUid: "uid",
      title: "Secret",
      isBusyProjection: true,
      startsAt: "2026-07-01T18:00:00Z",
      endsAt: "2026-07-01T19:00:00Z",
      startDate: null,
      endDateExclusive: null,
      allDay: false,
      timeZone: "America/Chicago",
      rrule: "FREQ=DAILY",
      status: "scheduled",
      sourceType: "native",
      sourceId: null,
      deepLink: "/app/h/calendar/event/e",
      lastModified: "2026-07-01T00:00:00Z",
      sequence: 1,
    });
    expect(ev.contractVersion).toBe(LIFEOS_CALENDAR_CONTRACT_VERSION);
    expect(ev.visibilitySafeTitle).toBe("Busy");
    expect(ev.rrule).toBeNull();
  });

  it("marks domain events as non-editable in calendar", () => {
    expect(resolveDomainProjection("chore").editableInCalendar).toBe(false);
    expect(resolveDomainProjection("meal_plan").lifecycleOwner).toBe("domain");
    expect(privacySafeFinanceTitle("bill", false, "$120 rent")).toBe(
      "Shared bill due",
    );
  });
});
