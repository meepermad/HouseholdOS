import { describe, expect, it } from "vitest";
import {
  ACTIVE_EVENT_TYPES,
  EVENT_PAYMENT_AWAITING_CONFIRMATION,
  EVENT_PAYMENT_ALLOCATION_CONFLICT,
} from "@/lib/notifications/catalog";
import {
  MAX_PUSH_PAYLOAD_BYTES,
  TEST_NOTIFICATION_TEMPLATE,
  buildPushContent,
  stripSensitive,
  validatePushPayloadSize,
} from "@/lib/notifications/templates";

const AMOUNT_OR_REF =
  /\$\d|\bUSD\b|\bcents?\b|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

describe("notification templates", () => {
  it("returns generic category copy when privacyPreview is generic", () => {
    const content = buildPushContent(EVENT_PAYMENT_AWAITING_CONFIRMATION, {
      privacyPreview: "generic",
      actorDisplayName: "Alex",
    });
    expect(content.title).toBe("Payment update in HouseholdOS");
    expect(content.body).toBe("Open HouseholdOS to review it.");
    expect(content.body).not.toContain("Alex");
  });

  it("returns detailed actor context without amounts or refs", () => {
    const content = buildPushContent(EVENT_PAYMENT_AWAITING_CONFIRMATION, {
      privacyPreview: "detailed",
      actorDisplayName: "Alex",
    });
    expect(content.title).toBe("Payment awaiting confirmation");
    expect(content.body).toContain("Alex");
    expect(content.title).not.toMatch(AMOUNT_OR_REF);
    expect(content.body).not.toMatch(AMOUNT_OR_REF);
  });

  it("forces generic for routing_only privacy class", () => {
    const content = buildPushContent(EVENT_PAYMENT_ALLOCATION_CONFLICT, {
      privacyPreview: "detailed",
      actorDisplayName: "Alex",
    });
    expect(content.title).toBe("Payment update in HouseholdOS");
    expect(content.body).not.toContain("Alex");
  });

  it("builds detailed templates for every active Phase 3 event", () => {
    for (const eventType of ACTIVE_EVENT_TYPES) {
      const content = buildPushContent(eventType, {
        privacyPreview: "detailed",
        actorDisplayName: "Sam",
      });
      expect(content.title.length).toBeGreaterThan(0);
      expect(content.body.length).toBeGreaterThan(0);
      expect(content.title).not.toMatch(AMOUNT_OR_REF);
      expect(content.body).not.toMatch(AMOUNT_OR_REF);
    }
  });

  it("strips amounts, tokens, bank fragments, and UUIDs", () => {
    expect(stripSensitive("Paid $12.50 totaling 100 USD")).not.toMatch(
      /\$|USD|\d+\s*USD/i,
    );
    expect(
      stripSensitive("token: abc.def password: hunter2"),
    ).not.toMatch(/token|password|hunter2/i);
    expect(stripSensitive("Send via venmo @user and zelle 123")).not.toMatch(
      /venmo|zelle/i,
    );
    expect(
      stripSensitive("id 550e8400-e29b-41d4-a716-446655440000 done"),
    ).not.toContain("550e8400");
  });

  it("rejects oversized push payloads", () => {
    expect(
      validatePushPayloadSize({
        title: TEST_NOTIFICATION_TEMPLATE.title,
        body: TEST_NOTIFICATION_TEMPLATE.body,
      }),
    ).toBe(true);

    const huge = { body: "x".repeat(MAX_PUSH_PAYLOAD_BYTES + 100) };
    expect(validatePushPayloadSize(huge)).toBe(false);
  });

  it("exposes a safe test notification template", () => {
    expect(TEST_NOTIFICATION_TEMPLATE.title).toContain("test");
    expect(TEST_NOTIFICATION_TEMPLATE.body).not.toMatch(AMOUNT_OR_REF);
  });
});
