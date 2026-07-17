import { describe, expect, it } from "vitest";
import {
  DEFAULT_FEED_SCOPE,
  FEED_SCOPES,
  buildCalendarUid,
  buildFeedUrl,
  feedTokensEqual,
  generateFeedToken,
  hashFeedToken,
  safeEventDeepLink,
  stripFeedTokenSuffix,
} from "@/lib/calendar/feed-token";

describe("feed token generation and hashing", () => {
  it("generates a 64-char hex token", () => {
    const token = generateFeedToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it("hashes tokens with sha256 hex", () => {
    const raw = "a".repeat(64);
    const hash = hashFeedToken(raw);
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(raw);
    expect(hashFeedToken(raw)).toBe(hash);
  });

  it("compares raw token to stored hash with timing-safe equality", () => {
    const raw = generateFeedToken();
    const stored = hashFeedToken(raw);
    expect(feedTokensEqual(raw, stored)).toBe(true);
  });

  it("rejects mismatched tokens (feed revocation concept)", () => {
    const oldToken = generateFeedToken();
    const newToken = generateFeedToken();
    const storedHash = hashFeedToken(oldToken);
    expect(feedTokensEqual(newToken, storedHash)).toBe(false);
    expect(feedTokensEqual(oldToken, hashFeedToken(newToken))).toBe(false);
  });

  it("rejects unequal-length stored hashes", () => {
    expect(feedTokensEqual("abc", "abcd")).toBe(false);
  });
});

describe("feed URL helpers", () => {
  it("builds a feed URL with .ics suffix", () => {
    const url = buildFeedUrl({
      origin: "https://householdos.app/",
      rawToken: "deadbeef",
    });
    expect(url).toBe("https://householdos.app/api/calendar/feed/deadbeef.ics");
  });

  it("strips .ics suffix from route param", () => {
    expect(stripFeedTokenSuffix("deadbeef.ics")).toBe("deadbeef");
    expect(stripFeedTokenSuffix("deadbeef")).toBe("deadbeef");
  });

  it("handles invalid or unexpected suffix without corrupting token", () => {
    expect(stripFeedTokenSuffix("token.ICS")).toBe("token.ICS");
    expect(stripFeedTokenSuffix("token.ics.backup")).toBe("token.ics.backup");
    expect(stripFeedTokenSuffix(".ics")).toBe("");
  });
});

describe("feed scope constants", () => {
  it("exposes feed scopes and default", () => {
    expect(FEED_SCOPES).toEqual(["visible_to_me", "household_public_only"]);
    expect(DEFAULT_FEED_SCOPE).toBe("visible_to_me");
    expect(FEED_SCOPES).toContain(DEFAULT_FEED_SCOPE);
  });
});

describe("stable calendar UIDs", () => {
  const householdId = "hh-abc";
  const eventId = "evt-xyz";

  it("builds a stable UID for master events", () => {
    const uid = buildCalendarUid({ householdId, eventId });
    expect(uid).toBe("householdos-hh-abc-evt-xyz@householdos.app");
    expect(buildCalendarUid({ householdId, eventId })).toBe(uid);
  });

  it("includes sanitized occurrence key for overrides", () => {
    const uid = buildCalendarUid({
      householdId,
      eventId,
      occurrenceKey: "2026-03-01T15:00:00.000Z",
    });
    expect(uid).toBe(
      "householdos-hh-abc-evt-xyz-20260301T150000000Z@householdos.app",
    );
  });
});

describe("safeEventDeepLink", () => {
  it("builds a safe in-app event deep link", () => {
    const link = safeEventDeepLink({
      origin: "https://householdos.app/",
      householdId: "hh-abc",
      eventId: "evt-xyz",
    });
    expect(link).toBe("https://householdos.app/app/hh-abc/calendar/event/evt-xyz");
    expect(link).not.toMatch(/javascript:/i);
    expect(link).not.toMatch(/\.ics/);
  });
});
