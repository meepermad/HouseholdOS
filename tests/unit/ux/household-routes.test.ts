import { describe, expect, it } from "vitest";
import {
  CALENDAR_LEGACY_REDIRECTS,
  householdRoutes,
  isCalendarPath,
} from "@/lib/routes/household";
import {
  HOUSEHOLD_NAV_ITEMS,
  QUICK_ADD_ACTIONS,
  primaryNavItems,
} from "@/lib/nav-items";

const HID = "11111111-1111-1111-1111-111111111111";
const EID = "22222222-2222-2222-2222-222222222222";

describe("householdRoutes", () => {
  it("builds canonical calendar landing as agenda", () => {
    expect(householdRoutes.calendar.agenda(HID)).toBe(
      `/app/${HID}/calendar/agenda`,
    );
    expect(householdRoutes.calendar.new(HID)).toBe(`/app/${HID}/calendar/new`);
    expect(householdRoutes.calendar.event(HID, EID)).toBe(
      `/app/${HID}/calendar/event/${EID}`,
    );
    expect(householdRoutes.calendar.availability(HID)).toBe(
      `/app/${HID}/calendar/availability`,
    );
  });

  it("preserves household id across primary destinations", () => {
    expect(householdRoutes.home(HID)).toContain(HID);
    expect(householdRoutes.chores.index(HID)).toContain(HID);
    expect(householdRoutes.money.index(HID)).toContain(HID);
    expect(householdRoutes.money.receiptNew(HID)).toBe(
      `/app/${HID}/money/receipts/new`,
    );
    expect(householdRoutes.setup(HID)).toBe(`/app/${HID}/setup`);
    expect(householdRoutes.settings.import(HID)).toContain(HID);
    expect(householdRoutes.settings.export(HID)).toContain(HID);
    expect(householdRoutes.house.index(HID)).toContain(HID);
    expect(householdRoutes.maintenance.index(HID)).toContain(HID);
    expect(householdRoutes.governance.index(HID)).toContain(HID);
  });

  it("rejects path-injection segments", () => {
    expect(() => householdRoutes.home("../evil")).toThrow(/Invalid/);
    expect(() => householdRoutes.calendar.event(HID, "a/b")).toThrow(/Invalid/);
  });

  it("marks all calendar subroutes active", () => {
    const paths = [
      `/app/${HID}/calendar`,
      `/app/${HID}/calendar/agenda`,
      `/app/${HID}/calendar/day`,
      `/app/${HID}/calendar/week`,
      `/app/${HID}/calendar/month`,
      `/app/${HID}/calendar/new`,
      `/app/${HID}/calendar/event/${EID}`,
      `/app/${HID}/calendar/events/${EID}`,
      `/app/${HID}/calendar/availability`,
      `/app/${HID}/calendar/invitations`,
    ];
    for (const path of paths) {
      expect(isCalendarPath(path, HID)).toBe(true);
    }
    expect(isCalendarPath(`/app/${HID}/settings/calendar`, HID)).toBe(false);
  });

  it("documents legacy redirect policy", () => {
    expect(CALENDAR_LEGACY_REDIRECTS.indexToAgenda).toBe(true);
    expect(CALENDAR_LEGACY_REDIRECTS.eventsNewToNew).toBe(true);
    expect(CALENDAR_LEGACY_REDIRECTS.eventsDetailToEvent).toBe(true);
  });
});

describe("navigation matrix hrefs", () => {
  it("points bottom Calendar at agenda", () => {
    const calendar = primaryNavItems().find((i) => i.key === "calendar");
    expect(calendar?.href(HID)).toBe(`/app/${HID}/calendar/agenda`);
    expect(calendar?.match(`/app/${HID}/calendar/month`, HID)).toBe(true);
    expect(calendar?.match(`/app/${HID}/calendar/event/${EID}`, HID)).toBe(
      true,
    );
  });

  it("points quick-add Create event at /calendar/new", () => {
    expect(QUICK_ADD_ACTIONS.find((a) => a.key === "event")?.href(HID)).toBe(
      `/app/${HID}/calendar/new`,
    );
  });

  it("keeps More destinations under the same household", () => {
    const moreKeys = [
      "house",
      "maintenance",
      "governance",
      "inbox",
      "settings",
      "profile",
      "search",
      "polls",
      "utilities",
      "emergency",
      "guests",
      "away",
      "review",
    ];
    for (const key of moreKeys) {
      const item = HOUSEHOLD_NAV_ITEMS.find((i) => i.key === key);
      expect(item, key).toBeTruthy();
      expect(item!.href(HID)).toContain(`/app/${HID}/`);
    }
  });
});
