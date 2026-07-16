import { describe, expect, it } from "vitest";
import {
  feedCacheControlHeaders,
  redactFeedToken,
} from "@/lib/calendar/feed-security";

describe("calendar feed security", () => {
  it("redacts labeled and URL feed tokens", () => {
    const raw = "aVeryLongCalendarFeedToken_123456";
    expect(redactFeedToken(`feed_token=${raw}`)).not.toContain(raw);
    expect(redactFeedToken(`/api/calendar/feed/${raw}`)).toBe(
      "/api/calendar/feed/[REDACTED]",
    );
  });

  it("requires private no-store caching", () => {
    const headers = feedCacheControlHeaders();
    expect(headers["cache-control"]).toContain("private");
    expect(headers["cache-control"]).toContain("no-store");
    expect(headers.pragma).toBe("no-cache");
  });
});
