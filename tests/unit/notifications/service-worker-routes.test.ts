import { describe, expect, it } from "vitest";
import { isSafeInternalRoute } from "@/lib/notifications/deep-links";

/**
 * Service-worker route checks must stay in lockstep with deep-links.ts.
 * Import the shared helper rather than duplicating logic from worker/index.ts.
 */
describe("service worker safe internal routes (via deep-links)", () => {
  it("allows same prefixes the SW may open", () => {
    expect(isSafeInternalRoute("/app/hh-1/notifications")).toBe(true);
    expect(isSafeInternalRoute("/onboarding/create")).toBe(true);
    expect(isSafeInternalRoute("/join")).toBe(true);
    expect(isSafeInternalRoute("/recovery")).toBe(true);
  });

  it("rejects external, javascript, data, and token-bearing routes", () => {
    expect(isSafeInternalRoute("https://example.com/app")).toBe(false);
    expect(isSafeInternalRoute("javascript:alert(1)")).toBe(false);
    expect(isSafeInternalRoute("data:text/html,hi")).toBe(false);
    expect(isSafeInternalRoute("/join?token=abc")).toBe(false);
    expect(isSafeInternalRoute("/app?invite=xyz")).toBe(false);
    expect(isSafeInternalRoute("//cdn.evil")).toBe(false);
  });
});
