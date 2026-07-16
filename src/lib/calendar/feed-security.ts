/**
 * Feed tokens are password-equivalent. Never log, audit, or telemetry the raw value.
 */

const TOKENISH =
  /(?:feed[_-]?token|token|bearer)[=:\s]+([A-Za-z0-9_-]{16,})/gi;

/** Redact likely raw feed tokens from log / error strings. */
export function redactFeedToken(value: string): string {
  return value
    .replace(TOKENISH, () => "token=[REDACTED]")
    .replace(
      /\/api\/calendar\/feed\/([A-Za-z0-9_.-]{16,})/gi,
      "/api/calendar/feed/[REDACTED]",
    );
}

export function feedCacheControlHeaders(): Record<string, string> {
  return {
    "cache-control": "private, no-store",
    pragma: "no-cache",
  };
}

/** Safe analytics properties — never include raw token or hash. */
export function feedAccessAnalyticsProps(params: {
  feedId?: string | null;
  scope?: string | null;
  status: "ok" | "not_found" | "rate_limited";
}): Record<string, string> {
  return {
    event: "calendar_feed_access",
    status: params.status,
    ...(params.feedId ? { feed_id: params.feedId } : {}),
    ...(params.scope ? { scope: params.scope } : {}),
  };
}
