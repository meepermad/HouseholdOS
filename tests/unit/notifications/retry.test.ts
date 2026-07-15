import { describe, expect, it } from "vitest";
import {
  BACKOFF_DELAYS_MS,
  MAX_ATTEMPTS,
  applyJitter,
  classifyPushError,
  nextRetryAt,
  shouldDeactivateSubscription,
} from "@/lib/notifications/retry";

describe("notification retry", () => {
  it("applies jitter within configured bounds", () => {
    const base = 1000;
    expect(applyJitter(base, 0.2, () => 0)).toBe(800);
    expect(applyJitter(base, 0.2, () => 0.999999)).toBe(1200);
    expect(applyJitter(base, 0.2, () => 0.5)).toBe(1000);
  });

  it("calculates backoff retries and dead-letters after max attempts", () => {
    const now = new Date("2026-07-15T12:00:00.000Z");
    const first = nextRetryAt(0, now, 0);
    expect(first?.getTime()).toBe(now.getTime() + BACKOFF_DELAYS_MS[0]!);

    const last = nextRetryAt(MAX_ATTEMPTS - 1, now, 0);
    expect(last?.getTime()).toBe(
      now.getTime() + BACKOFF_DELAYS_MS[MAX_ATTEMPTS - 1]!,
    );

    expect(nextRetryAt(MAX_ATTEMPTS, now, 0)).toBeNull();
    expect(nextRetryAt(-1, now, 0)).toBeNull();
    expect(nextRetryAt(1.5, now, 0)).toBeNull();
  });

  it("classifies permanent vs transient push errors", () => {
    expect(classifyPushError(410).kind).toBe("permanent");
    expect(classifyPushError(404).category).toBe("endpoint_not_found");
    expect(classifyPushError(401).kind).toBe("permanent");
    expect(classifyPushError(429).kind).toBe("transient");
    expect(classifyPushError(503).kind).toBe("transient");
    expect(classifyPushError(null, "network timeout").kind).toBe("transient");
    expect(classifyPushError(null, "subscription expired").kind).toBe(
      "permanent",
    );
  });

  it("deactivates only for gone/invalid subscription outcomes", () => {
    expect(
      shouldDeactivateSubscription(classifyPushError(410)),
    ).toBe(true);
    expect(
      shouldDeactivateSubscription(classifyPushError(404)),
    ).toBe(true);
    expect(
      shouldDeactivateSubscription(
        classifyPushError(null, "permission revoked"),
      ),
    ).toBe(true);
    expect(
      shouldDeactivateSubscription(classifyPushError(401)),
    ).toBe(false);
    expect(
      shouldDeactivateSubscription(classifyPushError(503)),
    ).toBe(false);
  });
});
