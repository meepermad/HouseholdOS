import { describe, expect, it } from "vitest";
import {
  shouldClearBadge,
  unreadBadgeCount,
} from "@/lib/notifications/badge";

describe("notification badge", () => {
  it("counts all unread when action_oriented is absent", () => {
    expect(
      unreadBadgeCount([
        { read_at: null },
        { read_at: "2026-07-15T00:00:00Z" },
        { read_at: null },
      ]),
    ).toBe(2);
  });

  it("counts only unread actionable rows when preference is present", () => {
    expect(
      unreadBadgeCount([
        { read_at: null, action_oriented: true },
        { read_at: null, action_oriented: false },
        { read_at: "2026-07-15T00:00:00Z", action_oriented: true },
        { read_at: null },
      ]),
    ).toBe(1);
  });

  it("clears badge when count is zero or negative", () => {
    expect(shouldClearBadge(0)).toBe(true);
    expect(shouldClearBadge(-1)).toBe(true);
    expect(shouldClearBadge(3)).toBe(false);
  });
});
