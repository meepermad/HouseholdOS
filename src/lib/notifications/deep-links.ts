const ALLOWED_PREFIXES = ["/app", "/onboarding", "/join", "/recovery"] as const;

const FORBIDDEN_SCHEME = /^(?:javascript|data|vbscript):/i;
const EXTERNAL_SCHEME = /^https?:/i;
const SENSITIVE_QUERY = /(?:^|[?&])(?:token|invite)=/i;

export const FALLBACK_DEEP_LINK = "/app";

/**
 * Same-app relative routes only. Rejects protocol-relative, schemes, and
 * invitation-token query patterns.
 */
export function isSafeInternalRoute(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed.startsWith("/")) return false;
  if (trimmed.startsWith("//")) return false;
  if (FORBIDDEN_SCHEME.test(trimmed)) return false;
  if (EXTERNAL_SCHEME.test(trimmed)) return false;

  const pathOnly = trimmed.split(/[?#]/, 1)[0] ?? trimmed;
  const allowed = ALLOWED_PREFIXES.some(
    (prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`),
  );
  if (!allowed) return false;

  const queryAndHash = trimmed.slice(pathOnly.length);
  if (SENSITIVE_QUERY.test(queryAndHash)) return false;

  return true;
}

export function normalizeDeepLink(href: string | null | undefined): string {
  if (typeof href !== "string") return FALLBACK_DEEP_LINK;
  const trimmed = href.trim();
  if (!trimmed) return FALLBACK_DEEP_LINK;
  return isSafeInternalRoute(trimmed) ? trimmed : FALLBACK_DEEP_LINK;
}

export function sanitizeNotificationDataUrl(url: unknown): string {
  if (typeof url !== "string") return FALLBACK_DEEP_LINK;
  return normalizeDeepLink(url);
}
