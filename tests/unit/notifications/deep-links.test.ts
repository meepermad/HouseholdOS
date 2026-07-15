import { describe, expect, it } from "vitest";
import {
  FALLBACK_DEEP_LINK,
  isSafeInternalRoute,
  normalizeDeepLink,
  sanitizeNotificationDataUrl,
} from "@/lib/notifications/deep-links";

describe("deep-links", () => {
  it("allows safe internal app routes", () => {
    expect(isSafeInternalRoute("/app")).toBe(true);
    expect(isSafeInternalRoute("/app/hh-1/money")).toBe(true);
    expect(isSafeInternalRoute("/onboarding")).toBe(true);
    expect(isSafeInternalRoute("/join")).toBe(true);
    expect(isSafeInternalRoute("/recovery")).toBe(true);
    expect(isSafeInternalRoute("/app/hh-1/money/payments/abc?tab=1")).toBe(
      true,
    );
  });

  it("rejects external, scheme, and protocol-relative URLs", () => {
    expect(isSafeInternalRoute("https://evil.example/app")).toBe(false);
    expect(isSafeInternalRoute("http://evil.example")).toBe(false);
    expect(isSafeInternalRoute("//evil.example/app")).toBe(false);
    expect(isSafeInternalRoute("javascript:alert(1)")).toBe(false);
    expect(isSafeInternalRoute("data:text/html,hi")).toBe(false);
    expect(isSafeInternalRoute("vbscript:msgbox(1)")).toBe(false);
  });

  it("rejects token/invite query params and disallowed prefixes", () => {
    expect(isSafeInternalRoute("/join?token=secret")).toBe(false);
    expect(isSafeInternalRoute("/app/hh?invite=abc")).toBe(false);
    expect(isSafeInternalRoute("/settings")).toBe(false);
    expect(isSafeInternalRoute("app/hh-1")).toBe(false);
    expect(isSafeInternalRoute("")).toBe(false);
  });

  it("normalizes unsafe or empty hrefs to the fallback", () => {
    expect(normalizeDeepLink(null)).toBe(FALLBACK_DEEP_LINK);
    expect(normalizeDeepLink(undefined)).toBe(FALLBACK_DEEP_LINK);
    expect(normalizeDeepLink("")).toBe(FALLBACK_DEEP_LINK);
    expect(normalizeDeepLink("https://evil.example")).toBe(FALLBACK_DEEP_LINK);
    expect(normalizeDeepLink("/app/hh-1")).toBe("/app/hh-1");
  });

  it("sanitizes notification data urls the same way", () => {
    expect(sanitizeNotificationDataUrl(42)).toBe(FALLBACK_DEEP_LINK);
    expect(sanitizeNotificationDataUrl("javascript:alert(1)")).toBe(
      FALLBACK_DEEP_LINK,
    );
    expect(sanitizeNotificationDataUrl("/recovery")).toBe("/recovery");
  });
});
