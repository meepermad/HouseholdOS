import { describe, expect, it } from "vitest";
import {
  ACTIVE_EVENT_TYPES,
  getCatalogEntry,
} from "@/lib/notifications/catalog";
import {
  PHASE3_RECIPIENT_RULES,
  describeRecipientRule,
  expectedRecipientRule,
} from "@/lib/notifications/recipients";

describe("Phase 3 recipient rules", () => {
  it("defines a recipient rule for every active catalog event", () => {
    const covered = new Set(PHASE3_RECIPIENT_RULES.map((r) => r.eventType));
    for (const eventType of ACTIVE_EVENT_TYPES) {
      expect(covered.has(eventType)).toBe(true);
      expect(expectedRecipientRule(eventType)).toBe(
        getCatalogEntry(eventType)?.recipientRule,
      );
    }
  });

  it("matches catalog recipientRule for each Phase 3 expectation", () => {
    for (const expectation of PHASE3_RECIPIENT_RULES) {
      const entry = getCatalogEntry(expectation.eventType);
      expect(entry?.recipientRule).toBe(expectation.rule);
      expect(expectation.description.length).toBeGreaterThan(0);
      expect(describeRecipientRule(expectation.eventType)).toBe(
        expectation.description,
      );
    }
  });

  it("documents the active payment / dispute / expense fan-out rules", () => {
    expect(expectedRecipientRule("payment.awaiting_confirmation")).toBe(
      "payment_recipient",
    );
    expect(expectedRecipientRule("payment.confirmed")).toBe("payment_sender");
    expect(expectedRecipientRule("payment.rejected")).toBe("payment_sender");
    expect(expectedRecipientRule("payment.cancelled")).toBe(
      "payment_recipient",
    );
    expect(expectedRecipientRule("payment.reversed")).toBe("other_party");
    expect(expectedRecipientRule("waiver.created")).toBe("debtor");
    expect(expectedRecipientRule("waiver.reversed")).toBe("debtor");
    expect(expectedRecipientRule("dispute.opened")).toBe(
      "other_active_members",
    );
    expect(expectedRecipientRule("dispute.resolved")).toBe("raiser");
    expect(expectedRecipientRule("refund_obligation.created")).toBe("debtor");
    expect(expectedRecipientRule("expense.voided")).toBe(
      "other_active_members",
    );
    expect(expectedRecipientRule("expense.amended")).toBe(
      "other_active_members",
    );
  });

  it("describes unknown events without throwing", () => {
    expect(describeRecipientRule("unknown.event")).toMatch(/Unknown event/);
    expect(expectedRecipientRule("unknown.event")).toBeUndefined();
  });
});
