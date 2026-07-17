import "server-only";

import { timingSafeEqual } from "node:crypto";

export type WorkerAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Authorize an internal worker request with a family-specific bearer secret.
 * Never log the presented or expected secret.
 */
export function authorizeWorkerSecret(
  request: Request,
  expectedSecret: string | undefined,
  familyLabel: string,
): WorkerAuthResult {
  if (!expectedSecret || expectedSecret.length < 16) {
    return {
      ok: false,
      status: 503,
      error: `${familyLabel} worker secret is not configured`,
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

/** @deprecated Prefer authorizeWorkerSecret with an explicit family label. */
export function authorizeNotificationWorker(
  request: Request,
  expectedSecret: string | undefined,
): WorkerAuthResult {
  return authorizeWorkerSecret(request, expectedSecret, "Notification");
}

/** Timing-safe string compare; unequal lengths never call unequal Buffer compare. */
function timingSafeEqualSecrets(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
