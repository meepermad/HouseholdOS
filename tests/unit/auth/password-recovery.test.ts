import { describe, expect, it } from "vitest";
import {
  classifyCallbackAuthError,
  isAllowedRecoveryNext,
  isRecoveryAuthErrorCode,
  mapRecoveryAuthErrorMessage,
  GENERIC_FORGOT_SUCCESS,
} from "@/lib/auth/password-recovery";
import { buildAppAbsoluteUrl } from "@/lib/env/canonical-origin";
import { safeRedirectPath } from "@/lib/navigation";
import { clearRateLimitBuckets, rateLimit } from "@/lib/auth/rate-limit";
import { AUTH_NO_STORE_HEADERS } from "@/lib/security/sensitive-query";

describe("password recovery helpers", () => {
  it("maps callback errors without leaking details", () => {
    expect(classifyCallbackAuthError("otp_expired", "Link expired")).toBe(
      "link_expired",
    );
    expect(classifyCallbackAuthError("access_denied", "already used")).toBe(
      "link_used",
    );
    expect(classifyCallbackAuthError("access_denied", "invalid token")).toBe(
      "link_invalid",
    );
    expect(mapRecoveryAuthErrorMessage("link_expired")).not.toMatch(/supabase/i);
  });

  it("rejects external redirect destinations", () => {
    expect(safeRedirectPath("https://evil.example/phish", "/app")).toBe("/app");
    expect(safeRedirectPath("//evil.example", "/app")).toBe("/app");
    expect(isAllowedRecoveryNext("/reset-password")).toBe(true);
    expect(isAllowedRecoveryNext("/login")).toBe(false);
    expect(isAllowedRecoveryNext("https://evil.example")).toBe(false);
  });

  it("builds canonical recovery callback URLs", () => {
    const url = buildAppAbsoluteUrl(
      `/auth/callback?next=${encodeURIComponent("/reset-password")}`,
      "https://household-os-five.vercel.app",
    );
    expect(url).toBe(
      "https://household-os-five.vercel.app/auth/callback?next=%2Freset-password",
    );
    expect(url).not.toMatch(/localhost/);
  });

  it("uses a generic forgot success message", () => {
    expect(GENERIC_FORGOT_SUCCESS.toLowerCase()).toContain("if an account exists");
    expect(isRecoveryAuthErrorCode("password_updated")).toBe(true);
    expect(isRecoveryAuthErrorCode("not_a_code")).toBe(false);
  });

  it("rate limits after the configured window budget", () => {
    clearRateLimitBuckets();
    const key = "test-forgot:unit";
    for (let i = 0; i < 10; i += 1) {
      expect(rateLimit(key, 10, 60_000)).toBe(true);
    }
    expect(rateLimit(key, 10, 60_000)).toBe(false);
  });

  it("defines auth no-store security headers", () => {
    expect(AUTH_NO_STORE_HEADERS["Cache-Control"]).toBe("no-store");
    expect(AUTH_NO_STORE_HEADERS["Referrer-Policy"]).toBe("no-referrer");
    expect(AUTH_NO_STORE_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
  });
});
