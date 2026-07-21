/** True when the stored refresh token is gone/revoked and the session cannot be renewed. */
export function isStaleAuthSessionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code =
    "code" in error && typeof error.code === "string" ? error.code : "";
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";
  return (
    code === "refresh_token_not_found" ||
    code === "refresh_token_already_used" ||
    message.includes("refresh token not found") ||
    message.includes("invalid refresh token")
  );
}
