import { describe, expect, it } from "vitest";
import {
  groupNotifications,
  supersedeNotificationIds,
} from "@/lib/notifications/grouping";

describe("notification grouping", () => {
  it("collapses supply-like events into one card", () => {
    const groups = groupNotifications([
      {
        id: "1",
        eventType: "shopping.item_added",
        category: "house",
        createdAt: new Date().toISOString(),
        title: "Milk added",
        body: "a",
        readAt: null,
      },
      {
        id: "2",
        eventType: "supply.low",
        category: "house",
        createdAt: new Date().toISOString(),
        title: "Paper towels low",
        body: "b",
        readAt: null,
      },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.count).toBe(2);
    expect(groups[0]?.representative.title).toMatch(/2 updates/);
  });

  it("lists supersede candidates excluding the newer id", () => {
    expect(supersedeNotificationIds("new", ["old", "new", "older"])).toEqual([
      "old",
      "older",
    ]);
  });
});
