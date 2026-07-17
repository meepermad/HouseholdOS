import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_NAV_ITEMS,
  MAX_PRIMARY_NAV,
  QUICK_ADD_ACTIONS,
  enabledNavItems,
  moreNavBySection,
  moreNavItems,
  primaryNavItems,
  sidebarNavItems,
} from "@/lib/nav-items";

describe("nav items growth rules", () => {
  it("keeps primary bottom bar capped", () => {
    expect(primaryNavItems().length).toBeLessThanOrEqual(MAX_PRIMARY_NAV);
    expect(primaryNavItems().map((i) => i.key)).toEqual([
      "home",
      "calendar",
      "chores",
      "money",
    ]);
  });

  it("exposes coordination destinations under more", () => {
    const keys = moreNavItems().map((i) => i.key);
    expect(keys).toEqual(expect.arrayContaining([
      "house",
      "maintenance",
      "governance",
      "polls",
      "utilities",
      "emergency",
      "guests",
      "review",
      "search",
      "inbox",
      "settings",
      "profile",
      "away",
    ]));
    expect(moreNavBySection().map((g) => g.section)).toEqual([
      "household",
      "communication",
      "account",
    ]);
  });

  it("lists primary items before more in the sidebar", () => {
    const keys = sidebarNavItems().map((i) => i.key);
    expect(keys.slice(0, 4)).toEqual(["home", "calendar", "chores", "money"]);
    expect(enabledNavItems().length).toBe(HOUSEHOLD_NAV_ITEMS.filter((i) => i.enabled).length);
  });

  it("treats meals and recipes as house destinations", () => {
    const house = HOUSEHOLD_NAV_ITEMS.find((i) => i.key === "house");
    expect(house?.match("/app/h1/meals", "h1")).toBe(true);
    expect(house?.match("/app/h1/recipes/request", "h1")).toBe(true);
  });

  it("exposes quick-add deep links", () => {
    expect(QUICK_ADD_ACTIONS.find((a) => a.key === "guest")?.href("h1")).toBe(
      "/app/h1/guests/new",
    );
    expect(QUICK_ADD_ACTIONS.find((a) => a.key === "decision")?.href("h1")).toBe(
      "/app/h1/polls/new",
    );
    expect(QUICK_ADD_ACTIONS.find((a) => a.key === "event")?.href("h1")).toBe(
      "/app/h1/calendar/new",
    );
  });

  it("points Calendar primary nav at agenda landing", () => {
    const calendar = HOUSEHOLD_NAV_ITEMS.find((i) => i.key === "calendar");
    expect(calendar?.href("h1")).toBe("/app/h1/calendar/agenda");
    expect(calendar?.match("/app/h1/calendar/day", "h1")).toBe(true);
  });
});
