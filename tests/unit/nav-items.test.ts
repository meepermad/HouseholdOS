import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_NAV_ITEMS,
  MAX_PRIMARY_NAV,
  enabledNavItems,
  primaryNavItems,
  sidebarNavItems,
} from "@/lib/nav-items";

describe("nav items growth rules", () => {
  it("exposes only Home, Money, and Settings while other domains stay disabled", () => {
    expect(enabledNavItems().map((i) => i.key)).toEqual([
      "home",
      "money",
      "settings",
    ]);
    expect(HOUSEHOLD_NAV_ITEMS.some((i) => i.key === "tasks" && !i.enabled)).toBe(
      true,
    );
  });

  it("keeps the bottom bar at or under the primary cap", () => {
    expect(primaryNavItems().length).toBeLessThanOrEqual(MAX_PRIMARY_NAV);
    expect(primaryNavItems().every((i) => i.surface === "primary")).toBe(true);
  });

  it("lists the same enabled destinations in the sidebar today", () => {
    expect(sidebarNavItems().map((i) => i.key)).toEqual([
      "home",
      "money",
      "settings",
    ]);
  });
});
