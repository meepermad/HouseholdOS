import { describe, expect, it } from "vitest";
import { isStaleAuthSessionError } from "@/lib/supabase/auth-errors";

describe("isStaleAuthSessionError", () => {
  it("matches refresh_token_not_found", () => {
    expect(
      isStaleAuthSessionError({
        code: "refresh_token_not_found",
        message: "Invalid Refresh Token: Refresh Token Not Found",
      }),
    ).toBe(true);
  });

  it("matches message fallback", () => {
    expect(
      isStaleAuthSessionError({
        message: "Invalid Refresh Token",
      }),
    ).toBe(true);
  });

  it("rejects unrelated auth errors", () => {
    expect(
      isStaleAuthSessionError({
        code: "invalid_credentials",
        message: "Invalid login credentials",
      }),
    ).toBe(false);
    expect(isStaleAuthSessionError(null)).toBe(false);
  });
});
