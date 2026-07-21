/** Refresh-token reuse race (parallel getUser); session may still be valid. */
export function isRefreshTokenRaceError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code =
    "code" in error && typeof error.code === "string" ? error.code : "";
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";
  return (
    code === "refresh_token_already_used" ||
    message.includes("refresh token already used")
  );
}

/** Refresh token is gone/revoked; safe to clear local session cookies. */
export function isRevokedRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if (isRefreshTokenRaceError(error)) return false;
  const code =
    "code" in error && typeof error.code === "string" ? error.code : "";
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";
  return (
    code === "refresh_token_not_found" ||
    message.includes("refresh token not found") ||
    message.includes("invalid refresh token")
  );
}

/** @deprecated Prefer isRevokedRefreshTokenError / isRefreshTokenRaceError. */
export function isStaleAuthSessionError(error: unknown): boolean {
  return isRevokedRefreshTokenError(error) || isRefreshTokenRaceError(error);
}
