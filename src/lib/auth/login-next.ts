import { safeRedirectPath } from "@/lib/navigation";

/** Proxy forwards the current path so login `next=` can return to Add receipt. */
export const HOUSEHOLDOS_PATH_HEADER = "x-householdos-path";

/**
 * Safe return path after sign-in. Unlike recovery destinations, household
 * deep links (including `/money/receipts/new`) are kept.
 */
export function safeLoginReturnPath(
  candidate: string | null | undefined,
  fallback = "/app",
): string {
  const path = safeRedirectPath(candidate, fallback);
  if (path.startsWith("/recovery") || path.startsWith("/auth/")) {
    return fallback;
  }
  return path === "/" ? fallback : path;
}

export function loginUrlForPath(
  path: string,
  reason?: "session_expired",
): string {
  const next = safeLoginReturnPath(path);
  const params = new URLSearchParams({ next });
  if (reason) params.set("reason", reason);
  return `/login?${params.toString()}`;
}

export function receiptCaptureReturnPath(householdId: string): string {
  return `/app/${householdId}/money/receipts/new`;
}
