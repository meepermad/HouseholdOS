/**
 * Simple in-memory IP rate limiter for auth Route Handlers.
 * Resets per process; sufficient for bounded abuse protection alongside Supabase limits.
 */

const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000,
): boolean {
  const now = Date.now();
  const row = hits.get(key);
  if (!row || row.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (row.count >= limit) return false;
  row.count += 1;
  return true;
}

export function clientIpKey(prefix: string, request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `${prefix}:${ip}`;
}

/** Test helper — clear buckets between unit tests. */
export function clearRateLimitBuckets(): void {
  hits.clear();
}
