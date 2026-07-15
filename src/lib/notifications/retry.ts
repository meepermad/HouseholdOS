export const BACKOFF_DELAYS_MS = [
  60_000, // 1m
  300_000, // 5m
  1_800_000, // 30m
  7_200_000, // 2h
  43_200_000, // 12h
] as const;

export const MAX_ATTEMPTS = 5;

export type PushErrorClassification = {
  kind: "permanent" | "transient";
  code: string;
  category: string;
};

/**
 * Apply ±jitterRatio noise to a base delay.
 * `random` should return [0, 1); inject for deterministic tests.
 */
export function applyJitter(
  baseMs: number,
  jitterRatio = 0.2,
  random: () => number = Math.random,
): number {
  const ratio = Math.max(0, jitterRatio);
  const delta = baseMs * ratio;
  const offset = (random() * 2 - 1) * delta;
  return Math.max(0, Math.round(baseMs + offset));
}

/**
 * Next retry instant after a failed attempt.
 * `attemptCount` is the number of attempts already made (0-based index into backoff).
 * Returns null when the delivery should move to dead letter.
 */
export function nextRetryAt(
  attemptCount: number,
  now: Date,
  jitterRatio = 0.2,
): Date | null {
  if (
    !Number.isInteger(attemptCount) ||
    attemptCount < 0 ||
    attemptCount >= MAX_ATTEMPTS
  ) {
    return null;
  }

  const base = BACKOFF_DELAYS_MS[attemptCount];
  if (base === undefined) return null;

  return new Date(now.getTime() + applyJitter(base, jitterRatio));
}

export function classifyPushError(
  statusCode: number | null,
  message?: string,
): PushErrorClassification {
  const msg = (message ?? "").toLowerCase();

  if (
    msg.includes("invalid subscription") ||
    msg.includes("subscription expired") ||
    msg.includes("permission revoked") ||
    msg.includes("unauthorized") ||
    msg.includes("gone")
  ) {
    return {
      kind: "permanent",
      code: statusCode != null ? String(statusCode) : "invalid_subscription",
      category: msg.includes("permission")
        ? "permission_revoked"
        : "invalid_subscription",
    };
  }

  if (statusCode === 404 || statusCode === 410) {
    return {
      kind: "permanent",
      code: String(statusCode),
      category: statusCode === 410 ? "subscription_gone" : "endpoint_not_found",
    };
  }

  if (statusCode === 400 || statusCode === 401 || statusCode === 403) {
    return {
      kind: "permanent",
      code: String(statusCode),
      category: "client_rejected",
    };
  }

  if (statusCode === 429) {
    return {
      kind: "transient",
      code: "429",
      category: "rate_limited",
    };
  }

  if (statusCode != null && statusCode >= 500 && statusCode <= 599) {
    return {
      kind: "transient",
      code: String(statusCode),
      category: "server_error",
    };
  }

  if (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("network") ||
    msg.includes("econnreset") ||
    msg.includes("fetch failed")
  ) {
    return {
      kind: "transient",
      code: statusCode != null ? String(statusCode) : "network",
      category: msg.includes("timeout") || msg.includes("timed out")
        ? "timeout"
        : "network",
    };
  }

  if (statusCode == null) {
    return {
      kind: "transient",
      code: "unknown",
      category: "network",
    };
  }

  return {
    kind: "transient",
    code: String(statusCode),
    category: "unknown",
  };
}

export function shouldDeactivateSubscription(
  classification: PushErrorClassification,
): boolean {
  if (classification.kind !== "permanent") return false;
  return (
    classification.category === "subscription_gone" ||
    classification.category === "endpoint_not_found" ||
    classification.category === "invalid_subscription" ||
    classification.category === "permission_revoked" ||
    classification.code === "410" ||
    classification.code === "404"
  );
}
