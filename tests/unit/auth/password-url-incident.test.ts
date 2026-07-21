import { describe, expect, it } from "vitest";
import {
  buildCleanAuthUrl,
  isSensitiveQueryKey,
  urlHasSensitiveQueryKeys,
} from "@/lib/security/sensitive-query";
import { sanitizeUrlForLogs } from "@/lib/security/sanitize-url-for-logs";
import {
  detectSignInContentMode,
  mapSignInErrorMessage,
  parseFormUrlEncoded,
  signInErrorLoginPath,
} from "@/lib/auth/sign-in-request";
import { classifyRecoveryReason, recoveryCopy } from "@/lib/recovery";

const FIXTURE_PASSWORD = "test-password-not-real";

describe("sensitive query detection", () => {
  it("flags password keys without needing values", () => {
    expect(isSensitiveQueryKey("password")).toBe(true);
    expect(isSensitiveQueryKey("PASSWORD")).toBe(true);
    expect(isSensitiveQueryKey("access_token")).toBe(true);
    expect(isSensitiveQueryKey("next")).toBe(false);
  });

  it("detects sensitive keys in search params", () => {
    const params = new URLSearchParams();
    params.set("email", "user@example.com");
    params.set("password", FIXTURE_PASSWORD);
    expect(urlHasSensitiveQueryKeys(params)).toBe(true);
  });

  it("builds a clean auth URL without credential keys", () => {
    const dirty = new URLSearchParams();
    dirty.set("password", FIXTURE_PASSWORD);
    dirty.set("email", "user@example.com");
    dirty.set("next", "/app/abc");
    const clean = buildCleanAuthUrl("https://example.test", "/login", dirty);
    expect(clean.pathname).toBe("/login");
    expect(clean.searchParams.get("reason")).toBe("cleared_sensitive_query");
    expect(clean.searchParams.get("next")).toBe("/app/abc");
    expect(clean.searchParams.has("password")).toBe(false);
    expect(clean.searchParams.has("email")).toBe(false);
    expect(clean.toString()).not.toContain(FIXTURE_PASSWORD);
  });
});

describe("sanitizeUrlForLogs", () => {
  it("redacts sensitive values before logging", () => {
    const raw = `https://example.test/login?password=${FIXTURE_PASSWORD}&next=/app`;
    const out = sanitizeUrlForLogs(raw);
    expect(out).toContain("password=%5BREDACTED%5D");
    expect(out).not.toContain(FIXTURE_PASSWORD);
  });
});

describe("sign-in request helpers", () => {
  it("detects json and form content types", () => {
    expect(detectSignInContentMode("application/json")).toBe("json");
    expect(
      detectSignInContentMode("application/x-www-form-urlencoded"),
    ).toBe("form");
    expect(detectSignInContentMode("text/plain")).toBe("unsupported");
  });

  it("maps form failures to clean login paths", () => {
    const path = signInErrorLoginPath("invalid_credentials");
    expect(path).toBe("/login?error=invalid_credentials");
    expect(path).not.toContain(FIXTURE_PASSWORD);
    expect(path).not.toContain("@");
  });

  it("parses form bodies without logging", () => {
    const record = parseFormUrlEncoded(
      `email=user%40example.com&password=${encodeURIComponent(FIXTURE_PASSWORD)}&next=%2Fapp`,
    );
    expect(record.email).toBe("user@example.com");
    expect(record.next).toBe("/app");
    expect(mapSignInErrorMessage("origin")).toMatch(/origin/i);
  });
});

describe("cleared sensitive query recovery copy", () => {
  it("classifies and copies without secrets", () => {
    expect(classifyRecoveryReason("cleared_sensitive_query")).toBe(
      "cleared_sensitive_query",
    );
    const copy = recoveryCopy("cleared_sensitive_query");
    expect(copy.title).toMatch(/cleared/i);
    expect(copy.body).toMatch(/reset your password/i);
  });
});
