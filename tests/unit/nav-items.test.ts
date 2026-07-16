import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_NAV_ITEMS,
  MAX_PRIMARY_NAV,
  enabledNavItems,
  primaryNavItems,
  sidebarNavItems,
} from "@/lib/nav-items";

describe("nav items growth rules", () => {
  it("exposes the Phase 6 household destinations", () => {
    expect(enabledNavItems().map((i) => i.key)).toEqual([
      "home",
      "calendar",
      "chores",
      "money",
      "settings",
      "inbox",
      "house",
    ]);
    expect(HOUSEHOLD_NAV_ITEMS.some((i) => i.key === "house" && i.enabled)).toBe(true);
  });

  it("keeps the bottom bar at or under the primary cap", () => {
    expect(primaryNavItems().length).toBeLessThanOrEqual(MAX_PRIMARY_NAV);
    expect(primaryNavItems().every((i) => i.surface === "primary")).toBe(true);
    expect(primaryNavItems().map((i) => i.key)).toEqual([
      "home",
      "calendar",
      "chores",
      "money",
    ]);
  });

  it("lists primary items before settings, inbox, and house", () => {
    expect(sidebarNavItems().map((i) => i.key)).toEqual([
      "home",
      "calendar",
      "chores",
      "money",
      "settings",
      "inbox",
      "house",
    ]);
  });
});
