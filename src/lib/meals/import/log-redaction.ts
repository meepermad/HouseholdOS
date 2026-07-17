/**
 * Phase 6.6 — log redaction helpers for recipe URL import.
 *
 * Pure utilities (safe on client or server) that strip potentially sensitive
 * parts of a URL before it reaches logs, audit records, or error messages.
 * We preserve protocol / host / path (useful for debugging and rate limiting
 * by hostname) but drop the query string, fragment, and any embedded
 * credentials, since those frequently carry tokens, session ids, or PII.
 */

const REDACTED_MARK = "[redacted]";

/**
 * Redact a URL for logging.
 *
 * Preserves `protocol//host/path` and replaces any query with `?[redacted]`
 * and any fragment with `#[redacted]`. Embedded userinfo (user:pass@) is
 * always dropped. Never throws; unparseable input yields a coarse placeholder
 * so callers can log unconditionally.
 */
export function redactUrlForLog(input: string | URL): string {
  let url: URL;
  try {
    url = input instanceof URL ? input : new URL(input);
  } catch {
    return "[unparseable-url]";
  }

  // `url.host` includes the port but never userinfo, so credentials are
  // dropped implicitly by reconstructing from parts.
  const path = url.pathname || "/";
  let out = `${url.protocol}//${url.host}${path}`;
  if (url.search) out += `?${REDACTED_MARK}`;
  if (url.hash) out += `#${REDACTED_MARK}`;
  return out;
}

/**
 * Extract just the lowercase hostname for grouping / rate-limit keys, or a
 * placeholder when the input cannot be parsed. Never throws.
 */
export function safeHostnameForLog(input: string | URL): string {
  try {
    const url = input instanceof URL ? input : new URL(input);
    return url.hostname.toLowerCase();
  } catch {
    return "[unparseable-host]";
  }
}

/**
 * Redact any URLs that appear inside a free-form string (e.g. an error message
 * bubbled up from a networking library that interpolated the target URL).
 */
export function redactUrlsInText(text: string): string {
  return text.replace(/\bhttps?:\/\/[^\s"'<>]+/gi, (match) =>
    redactUrlForLog(match),
  );
}
