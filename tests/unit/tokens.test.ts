import { describe, expect, it } from "vitest";
import {
  generateInviteToken,
  hashInviteToken,
  invitationExpiresAt,
  isInvitationExpired,
  buildAuditRow,
} from "@/lib/tokens";

describe("invitation tokens", () => {
  it("generates a strong raw token", () => {
    const token = generateInviteToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it("hashes tokens with sha256 hex", () => {
    const token = "a".repeat(64);
    const hash = hashInviteToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(token);
    expect(hashInviteToken(token)).toBe(hash);
  });

  it("detects expiration", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isInvitationExpired(past)).toBe(true);
    expect(isInvitationExpired(future)).toBe(false);
  });

  it("computes ttl expiry", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const expires = invitationExpiresAt(24, now);
    expect(expires.toISOString()).toBe("2026-01-02T00:00:00.000Z");
  });
});

describe("audit construction", () => {
  it("builds a safe audit row with correlation id", () => {
    const row = buildAuditRow({
      householdId: "11111111-1111-4111-8111-111111111111",
      actorUserId: "22222222-2222-4222-8222-222222222222",
      entityType: "household",
      entityId: "11111111-1111-4111-8111-111111111111",
      eventType: "household.created",
      afterState: { name: "Oak St" },
    });
    expect(row.event_type).toBe("household.created");
    expect(row.correlation_id).toBeTruthy();
    expect(JSON.stringify(row)).not.toMatch(/password|token|secret/i);
  });
});
