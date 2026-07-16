import { describe, expect, it } from "vitest";
import {
  ACTIVE_EVENT_TYPES,
  CATEGORY_PREFERENCE_DEFAULTS,
  CONCEPTUAL_EVENT_ALIASES,
  EVENT_CHORE_ASSIGNED,
  EVENT_PAYMENT_AWAITING_CONFIRMATION,
  EVENT_PAYMENT_SUBMITTED,
  EVENT_REIMBURSEMENT_WAIVED,
  EVENT_WAIVER_CREATED,
  NOTIFICATION_CATALOG,
  getCatalogEntry,
  isActiveEventType,
} from "@/lib/notifications/catalog";

describe("notification catalog", () => {
  it("maps conceptual aliases to canonical Phase 3 event types", () => {
    expect(CONCEPTUAL_EVENT_ALIASES["payment.submitted"]).toBe(
      EVENT_PAYMENT_AWAITING_CONFIRMATION,
    );
    expect(EVENT_PAYMENT_SUBMITTED).toBe(EVENT_PAYMENT_AWAITING_CONFIRMATION);
    expect(EVENT_REIMBURSEMENT_WAIVED).toBe(EVENT_WAIVER_CREATED);
    expect(CONCEPTUAL_EVENT_ALIASES["reimbursement.waived"]).toBe(
      EVENT_WAIVER_CREATED,
    );
  });

  it("lists only active events in ACTIVE_EVENT_TYPES", () => {
    expect(ACTIVE_EVENT_TYPES.length).toBeGreaterThan(0);
    for (const eventType of ACTIVE_EVENT_TYPES) {
      expect(NOTIFICATION_CATALOG[eventType]?.active).toBe(true);
      expect(isActiveEventType(eventType)).toBe(true);
    }
  });

  it("marks Phase 5 chore events as active", () => {
    expect(getCatalogEntry(EVENT_CHORE_ASSIGNED)?.active).toBe(true);
    expect(isActiveEventType(EVENT_CHORE_ASSIGNED)).toBe(true);
    expect(ACTIVE_EVENT_TYPES).toContain(EVENT_CHORE_ASSIGNED);
  });

  it("returns catalog entries with expected Phase 3 payment mapping", () => {
    const awaiting = getCatalogEntry(EVENT_PAYMENT_AWAITING_CONFIRMATION);
    expect(awaiting).toMatchObject({
      category: "payments",
      recipientRule: "payment_recipient",
      defaultUrgency: "high",
      digestAllowed: false,
      actionOriented: true,
      privacy: "generic_ok",
      active: true,
    });
    expect(awaiting?.defaultChannels).toEqual(["in_app", "push"]);
  });

  it("returns undefined for unknown event types", () => {
    expect(getCatalogEntry("not.a.real.event")).toBeUndefined();
    expect(isActiveEventType("not.a.real.event")).toBe(false);
  });

  it("seeds category preference defaults", () => {
    expect(CATEGORY_PREFERENCE_DEFAULTS.payments).toEqual({
      deliveryMode: "immediate",
      channels: ["in_app", "push"],
      defaultUrgency: "high",
      quietHoursRespected: true,
    });
    expect(CATEGORY_PREFERENCE_DEFAULTS.chores.deliveryMode).toBe(
      "daily_digest",
    );
    expect(CATEGORY_PREFERENCE_DEFAULTS.system.channels).toEqual(["in_app"]);
    expect(CATEGORY_PREFERENCE_DEFAULTS.membership.quietHoursRespected).toBe(
      false,
    );
  });

  it("covers every category with preference defaults", () => {
    const categories = new Set(
      Object.values(NOTIFICATION_CATALOG).map((e) => e.category),
    );
    categories.add("system");
    for (const category of categories) {
      expect(CATEGORY_PREFERENCE_DEFAULTS[category]).toBeDefined();
    }
  });
});
