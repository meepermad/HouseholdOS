import { describe, expect, it } from "vitest";
import {
  EVENT_RECEIPT_CLAIM_COMPLETED,
  EVENT_RECEIPT_CLAIM_REMINDER,
  EVENT_RECEIPT_CLAIM_REQUESTED,
  EVENT_RECEIPT_CLAIMING_STARTED,
  EVENT_RECEIPT_READY_FOR_PAYER_REVIEW,
  getCatalogEntry,
} from "@/lib/notifications/catalog";
import { buildPushContent } from "@/lib/notifications/templates";
import { groupNotifications } from "@/lib/notifications/grouping";

describe("receipt claim notifications", () => {
  it("deep-links claiming to the receipt, not the money hub", () => {
    expect(getCatalogEntry(EVENT_RECEIPT_CLAIMING_STARTED)?.deepLinkPattern).toBe(
      "/app/{householdId}/money/receipts/{entityId}?claim=1",
    );
    expect(getCatalogEntry(EVENT_RECEIPT_CLAIM_REQUESTED)?.deepLinkPattern).toContain(
      "?claim=1",
    );
    expect(getCatalogEntry(EVENT_RECEIPT_READY_FOR_PAYER_REVIEW)?.deepLinkPattern).toBe(
      "/app/{householdId}/money/receipts/{entityId}",
    );
    expect(getCatalogEntry(EVENT_RECEIPT_CLAIM_REMINDER)?.actionOriented).toBe(true);
  });

  it("omits totals from push preview copy", () => {
    for (const eventType of [
      EVENT_RECEIPT_CLAIMING_STARTED,
      EVENT_RECEIPT_CLAIM_REQUESTED,
      EVENT_RECEIPT_CLAIM_COMPLETED,
      EVENT_RECEIPT_READY_FOR_PAYER_REVIEW,
      EVENT_RECEIPT_CLAIM_REMINDER,
    ]) {
      const content = buildPushContent(eventType, {
        privacyPreview: "detailed",
        actorDisplayName: "Atem",
      });
      expect(content.title).not.toMatch(/\$\d/);
      expect(content.body).not.toMatch(/\$\d/);
      expect(content.body).not.toMatch(/92\.40/);
    }
  });

  it("groups receipt updates instead of one card per claimed item", () => {
    const groups = groupNotifications([
      {
        id: "1",
        eventType: EVENT_RECEIPT_CLAIM_COMPLETED,
        category: "expenses",
        createdAt: new Date().toISOString(),
        title: "Andrew finished",
        body: "Open the receipt",
        readAt: null,
      },
      {
        id: "2",
        eventType: EVENT_RECEIPT_CLAIM_COMPLETED,
        category: "expenses",
        createdAt: new Date().toISOString(),
        title: "Henry finished",
        body: "Open the receipt",
        readAt: null,
      },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.count).toBe(2);
  });
});
