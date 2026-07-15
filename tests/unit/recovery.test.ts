import { describe, expect, it } from "vitest";
import {
  classifyRecoveryReason,
  formatErrorReference,
  householdCookieClearOptions,
  recoveryCopy,
  safeRecoveryDestination,
} from "@/lib/recovery";
import { safeRedirectPath } from "@/lib/navigation";

describe("recovery helpers", () => {
  it("classifies known recovery reasons", () => {
    expect(classifyRecoveryReason("stale_selection")).toBe("stale_selection");
    expect(classifyRecoveryReason("signed_out")).toBe("signed_out");
    expect(classifyRecoveryReason("evil")).toBe("unexpected");
    expect(classifyRecoveryReason(undefined)).toBe("unexpected");
  });

  it("rejects external redirect destinations", () => {
    expect(safeRedirectPath("https://evil.example")).toBe("/app");
    expect(safeRedirectPath("//evil.example")).toBe("/app");
    expect(safeRecoveryDestination("https://evil.example")).toBe("/app");
    expect(safeRecoveryDestination("/app/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")).toBe(
      "/app",
    );
    expect(safeRecoveryDestination("/recovery")).toBe("/app");
    expect(safeRecoveryDestination("/onboarding")).toBe("/onboarding");
  });

  it("formats safe error references", () => {
    expect(formatErrorReference("abc-123")).toBe("abc-123");
    expect(formatErrorReference("bad<script>")).toBe("badscript");
    expect(formatErrorReference(undefined)).toBeNull();
    expect(formatErrorReference("@@@")).toBeNull();
  });

  it("exposes cookie clear options that match path and httpOnly", () => {
    const opts = householdCookieClearOptions(true);
    expect(opts.path).toBe("/");
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.maxAge).toBe(0);
    expect(opts.secure).toBe(true);
  });

  it("provides user-facing recovery copy", () => {
    expect(recoveryCopy("database_unavailable").title).toMatch(/unavailable/i);
    expect(recoveryCopy("unexpected").body).toMatch(/sign out/i);
  });
});
