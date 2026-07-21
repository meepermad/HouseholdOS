import { describe, expect, it } from "vitest";
import {
  isRefreshTokenRaceError,
  isRevokedRefreshTokenError,
  isStaleAuthSessionError,
} from "@/lib/supabase/auth-errors";

describe("auth session errors", () => {
  it("treats already_used as a race, not a revoke", () => {
    const err = {
      code: "refresh_token_already_used",
      message: "Invalid Refresh Token: Already Used",
    };
    expect(isRefreshTokenRaceError(err)).toBe(true);
    expect(isRevokedRefreshTokenError(err)).toBe(false);
    expect(isStaleAuthSessionError(err)).toBe(true);
  });

  it("matches refresh_token_not_found as revoked", () => {
    const err = {
      code: "refresh_token_not_found",
      message: "Invalid Refresh Token: Refresh Token Not Found",
    };
    expect(isRevokedRefreshTokenError(err)).toBe(true);
    expect(isRefreshTokenRaceError(err)).toBe(false);
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
