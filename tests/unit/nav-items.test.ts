import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_NAV_ITEMS,
  MAX_PRIMARY_NAV,
  enabledNavItems,
  moreNavItems,
  primaryNavItems,
  sidebarNavItems,
} from "@/lib/nav-items";

describe("nav items growth rules", () => {
  it("exposes the Phase 7 household destinations", () => {
    expect(enabledNavItems().map((i) => i.key)).toEqual([
      "home",
      "calendar",
      "chores",
      "money",
      "settings",
      "inbox",
      "house",
      "maintenance",
    ]);
    expect(HOUSEHOLD_NAV_ITEMS.some((i) => i.key === "house" && i.enabled)).toBe(true);
    expect(HOUSEHOLD_NAV_ITEMS.some((i) => i.key === "maintenance" && i.enabled)).toBe(true);
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

  it("lists primary items before settings, inbox, house, and maintenance", () => {
    expect(sidebarNavItems().map((i) => i.key)).toEqual([
      "home",
      "calendar",
      "chores",
      "money",
      "settings",
      "inbox",
      "house",
      "maintenance",
    ]);
  });

  it("exposes house and maintenance under more for mobile overflow", () => {
    expect(moreNavItems().map((i) => i.key)).toEqual([
      "settings",
      "inbox",
      "house",
      "maintenance",
    ]);
  });

  it("treats meals and recipes as house destinations", () => {
    const house = HOUSEHOLD_NAV_ITEMS.find((i) => i.key === "house");
    expect(house?.match("/app/h1/meals", "h1")).toBe(true);
    expect(house?.match("/app/h1/recipes/request", "h1")).toBe(true);
    expect(house?.match("/app/h1/meal-prep", "h1")).toBe(true);
    expect(house?.match("/app/h1/money", "h1")).toBe(false);
  });
});

