import { describe, expect, it } from "vitest";
import {
  CATEGORY_PREFERENCE_DEFAULTS,
  CONFIGURABLE_NOTIFICATION_CHANNELS,
  INBOX_FILTER_CATEGORIES,
  IN_APP_LOCKED_CATEGORIES,
  NOTIFICATION_CHANNEL_SUPPORT,
  NOTIFICATION_DB_CATEGORIES,
  NOTIFICATION_PREFERENCE_GROUPS,
  PREFERENCE_CATEGORIES,
  SUPPORTED_DELIVERY_MODES,
  getPreferenceGroup,
  isNotificationDbCategory,
  parseInboxFilter,
} from "@/lib/notifications/catalog";

/**
 * These tests pin the promises the notification UI is allowed to make. Email
 * has no adapter and daily digest is never claimed or sent, so neither may be
 * offered as a choice anywhere.
 */
describe("notification preference honesty", () => {
  it("never offers a delivery mode the pipeline cannot honor", () => {
    expect(SUPPORTED_DELIVERY_MODES).toEqual(["immediate", "off"]);
    expect(SUPPORTED_DELIVERY_MODES).not.toContain("daily_digest");
  });

  it("marks email unavailable and excludes it from configurable channels", () => {
    expect(NOTIFICATION_CHANNEL_SUPPORT.email).toBe("unavailable");
    expect(NOTIFICATION_CHANNEL_SUPPORT.in_app).toBe("always_on");
    expect(NOTIFICATION_CHANNEL_SUPPORT.push).toBe("configurable");
    expect(CONFIGURABLE_NOTIFICATION_CHANNELS).toEqual(["push"]);
    expect(CONFIGURABLE_NOTIFICATION_CHANNELS).not.toContain("email");
    expect(CONFIGURABLE_NOTIFICATION_CHANNELS).not.toContain("in_app");
  });

  it("keeps every category default deliverable", () => {
    for (const [category, defaults] of Object.entries(
      CATEGORY_PREFERENCE_DEFAULTS,
    )) {
      expect(
        defaults.deliveryMode,
        `${category} default must be deliverable`,
      ).not.toBe("daily_digest");
      expect(
        defaults.channels,
        `${category} must not default to email`,
      ).not.toContain("email");
    }
  });

  it("exposes the seven preference groups in product order", () => {
    expect(NOTIFICATION_PREFERENCE_GROUPS.map((g) => g.key)).toEqual([
      "money",
      "chores",
      "calendar",
      "shopping_meals",
      "maintenance",
      "governance",
      "household_ops",
    ]);
    expect(NOTIFICATION_PREFERENCE_GROUPS.map((g) => g.label)).toEqual([
      "Money",
      "Chores",
      "Calendar and guests",
      "Shopping and meals",
      "Maintenance",
      "Governance and meetings",
      "Household ops",
    ]);
  });

  it("covers every stored category exactly once across groups", () => {
    const covered = NOTIFICATION_PREFERENCE_GROUPS.flatMap(
      (g) => g.categories,
    );
    expect([...covered].sort()).toEqual([...NOTIFICATION_DB_CATEGORIES].sort());
    expect(new Set(covered).size).toBe(covered.length);
  });

  it("only groups categories that upsert_notification_preference accepts", () => {
    for (const group of NOTIFICATION_PREFERENCE_GROUPS) {
      for (const category of group.categories) {
        expect(isNotificationDbCategory(category)).toBe(true);
        expect(PREFERENCE_CATEGORIES).toContain(category);
      }
    }
  });

  it("keeps money in-app locked on to match the SQL guard", () => {
    const money = getPreferenceGroup("money");
    expect(money?.categories).toEqual(["payments", "disputes"]);
    for (const locked of IN_APP_LOCKED_CATEGORIES) {
      expect(money?.categories).toContain(locked);
    }
  });

  it("returns undefined for unknown group keys", () => {
    expect(getPreferenceGroup("email_digest")).toBeUndefined();
  });
});

describe("inbox filters and category deep links", () => {
  it("accepts only the three compact filters", () => {
    expect(parseInboxFilter("all")).toBe("all");
    expect(parseInboxFilter("action")).toBe("action");
    expect(parseInboxFilter("updates")).toBe("updates");
  });

  it("falls back to all for unknown or legacy filters", () => {
    expect(parseInboxFilter(undefined)).toBe("all");
    expect(parseInboxFilter("unread")).toBe("all");
    expect(parseInboxFilter("../../etc/passwd")).toBe("all");
  });

  it("offers only category filters the emitter actually writes", () => {
    expect(INBOX_FILTER_CATEGORIES).toEqual(NOTIFICATION_DB_CATEGORIES);
    // Previously offered but never stored, so the filter silently showed all.
    expect(INBOX_FILTER_CATEGORIES).toContain("house");
    expect(INBOX_FILTER_CATEGORIES).toContain("meals");
    expect(INBOX_FILTER_CATEGORIES).toContain("agreements");
  });

  it("rejects categories the emitter never writes", () => {
    for (const bogus of ["expenses", "inventory", "shopping", "approvals"]) {
      expect(isNotificationDbCategory(bogus)).toBe(false);
    }
  });
});
