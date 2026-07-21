import { describe, expect, it } from "vitest";
import { shouldAllowDeliveryRetry } from "@/lib/invitations/retry-guard";

describe("invitation delivery retry guard", () => {
  it("blocks repeated resend after successful send within cooldown", () => {
    const now = new Date("2026-07-21T18:00:00.000Z");
    const guard = shouldAllowDeliveryRetry({
      deliveryStatus: "sent",
      deliveryAttemptedAt: "2026-07-21T17:30:00.000Z",
      now,
      cooldownMs: 60 * 60 * 1000,
    });
    expect(guard.allowed).toBe(false);
    expect(guard.reason).toMatch(/already sent/i);
  });

  it("allows retry when previous delivery failed", () => {
    const guard = shouldAllowDeliveryRetry({
      deliveryStatus: "failed",
      deliveryAttemptedAt: "2026-07-21T17:30:00.000Z",
    });
    expect(guard.allowed).toBe(true);
  });

  it("does not attempt Auth invite again for existing_account", () => {
    const guard = shouldAllowDeliveryRetry({
      deliveryStatus: "existing_account",
      deliveryAttemptedAt: "2026-07-21T17:30:00.000Z",
    });
    expect(guard.allowed).toBe(false);
    expect(guard.reason).toMatch(/existing user/i);
  });
});
