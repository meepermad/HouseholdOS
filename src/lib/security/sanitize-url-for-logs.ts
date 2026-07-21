import { isSensitiveQueryKey } from "@/lib/security/sensitive-query";

const REDACTED = "[REDACTED]";

/**
 * Sanitize a URL string for diagnostics. Sensitive query values become [REDACTED]
 * without preserving length. Call before any logger sees the URL.
 */
export function sanitizeUrlForLogs(raw: string): string {
  try {
    const url = new URL(raw);
    const cleaned = new URLSearchParams();
    for (const [key, value] of url.searchParams.entries()) {
      if (isSensitiveQueryKey(key)) {
        cleaned.set(key, REDACTED);
      } else if (
        key.toLowerCase() === "email" ||
        key.toLowerCase() === "token"
      ) {
        cleaned.set(key, REDACTED);
      } else {
        cleaned.set(key, value);
      }
    }
    url.search = cleaned.toString();
    return url.toString();
  } catch {
    return "[invalid-url]";
  }
}
