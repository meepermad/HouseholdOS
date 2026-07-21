import { safeRedirectPath } from "@/lib/navigation";

/** Query parameter names that must never appear on auth URLs. */
export const SENSITIVE_QUERY_KEYS = [
  "password",
  "pass",
  "passwd",
  "currentpassword",
  "newpassword",
  "access_token",
  "refresh_token",
] as const;

const SENSITIVE_KEY_SET = new Set<string>(SENSITIVE_QUERY_KEYS);

export function isSensitiveQueryKey(key: string): boolean {
  return SENSITIVE_KEY_SET.has(key.toLowerCase());
}

/** True if any query key is denylisted (values are never inspected). */
export function urlHasSensitiveQueryKeys(searchParams: URLSearchParams): boolean {
  for (const key of searchParams.keys()) {
    if (isSensitiveQueryKey(key)) return true;
  }
  return false;
}

const AUTH_CLEANUP_PATHS = new Set([
  "/login",
  "/signup",
  "/recovery",
  "/forgot-password",
  "/reset-password",
]);

export function isAuthCleanupPath(pathname: string): boolean {
  return AUTH_CLEANUP_PATHS.has(pathname);
}

/**
 * Build a clean auth URL: drop all query keys, keep only validated `next`,
 * and set reason=cleared_sensitive_query. Never copies sensitive values.
 */
export function buildCleanAuthUrl(
  origin: string,
  pathname: string,
  searchParams: URLSearchParams,
): URL {
  const clean = new URL(pathname, origin);
  const nextRaw = searchParams.get("next");
  if (nextRaw) {
    clean.searchParams.set("next", safeRedirectPath(nextRaw, "/app"));
  }
  clean.searchParams.set("reason", "cleared_sensitive_query");
  return clean;
}

export const AUTH_NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;
