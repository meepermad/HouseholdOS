/**
 * Safe internal redirect targets only.
 * Rejects protocol-relative, absolute, and malformed paths.
 */
export function safeRedirectPath(
  candidate: string | null | undefined,
  fallback = "/app",
): string {
  if (!candidate) return fallback;
  const value = candidate.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("://")) return fallback;
  if (value.includes("\\")) return fallback;
  if (/[\x00-\x1f]/.test(value)) return fallback;
  return value;
}

export const CURRENT_HOUSEHOLD_COOKIE = "householdos_current_household";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isHouseholdId(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

export function validateCurrentHouseholdSelection(params: {
  requestedId: string | null | undefined;
  authorizedHouseholdIds: readonly string[];
}): string | null {
  const { requestedId, authorizedHouseholdIds } = params;
  if (!requestedId || !isHouseholdId(requestedId)) return null;
  if (!authorizedHouseholdIds.includes(requestedId)) return null;
  return requestedId;
}
