import { describe, expect, it } from "vitest";
import {
  hashEndpoint,
  pushSubscriptionClientSchema,
  summarizeUserAgent,
} from "@/lib/notifications/subscription";

describe("push subscription helpers", () => {
  it("hashes endpoints stably for dedup", () => {
    const a = hashEndpoint("https://push.example/endpoint-1");
    const b = hashEndpoint("https://push.example/endpoint-1");
    const c = hashEndpoint("https://push.example/endpoint-2");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(a).not.toBe(c);
  });

  it("rejects oversized subscription payloads via schema", () => {
    const valid = {
      endpoint: "https://push.example/abc",
      keys: { p256dh: "pk", auth: "ak" },
    };
    expect(pushSubscriptionClientSchema.safeParse(valid).success).toBe(true);

    const oversizedEndpoint = {
      ...valid,
      endpoint: `https://push.example/${"x".repeat(2100)}`,
    };
    expect(
      pushSubscriptionClientSchema.safeParse(oversizedEndpoint).success,
    ).toBe(false);

    const oversizedKey = {
      ...valid,
      keys: { p256dh: "p".repeat(513), auth: "ak" },
    };
    expect(pushSubscriptionClientSchema.safeParse(oversizedKey).success).toBe(
      false,
    );
  });

  it("summarizes user agents into platform categories", () => {
    expect(
      summarizeUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
      ),
    ).toMatchObject({
      platformCategory: "mobile",
      userAgentSummary: expect.stringContaining("mobile/Apple"),
    });

    expect(
      summarizeUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ),
    ).toMatchObject({
      platformCategory: "desktop",
      userAgentSummary: expect.stringContaining("desktop/Windows/Chrome"),
    });

    expect(summarizeUserAgent(null)).toEqual({
      platformCategory: "unknown",
      userAgentSummary: "unknown",
    });
  });
});
