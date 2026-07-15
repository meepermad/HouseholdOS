import "server-only";

import { timingSafeEqual } from "node:crypto";

export function authorizeNotificationWorker(
  request: Request,
  expectedSecret: string | undefined,
): { ok: true } | { ok: false; status: number; error: string } {
  if (!expectedSecret || expectedSecret.length < 16) {
    return {
      ok: false,
      status: 503,
      error: "Notification worker secret is not configured",
    };
  }

  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return {
      ok: false,
      status: 401,
      error: "Missing or invalid Authorization bearer token",
    };
  }

  const presented = header.slice("Bearer ".length).trim();
  if (!presented) {
    return {
      ok: false,
      status: 401,
      error: "Missing or invalid Authorization bearer token",
    };
  }

  if (!timingSafeEqualSecrets(presented, expectedSecret)) {
    return {
      ok: false,
      status: 401,
      error: "Invalid Authorization bearer token",
    };
  }

  return { ok: true };
}

/** Timing-safe string compare; unequal lengths never call unequal Buffer compare. */
function timingSafeEqualSecrets(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Burn a same-length compare so length mismatch is not an early easy path.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
