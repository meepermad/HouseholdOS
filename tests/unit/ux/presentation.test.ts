import { describe, expect, it } from "vitest";
import {
  formatAuditEventLabel,
  formatNotificationCategory,
  formatRoleLabel,
  humanizeEnum,
} from "@/lib/presentation";
import { prioritizeAttention } from "@/lib/home/action-center";
import {
  formatMinutesAsTime,
  minutesToTimeValue,
  timeValueToMinutes,
} from "@/components/ui/time-field";
import { parseUsdToCents, formatUsdFromCents, toCents } from "@/lib/money";
import { selectEmptyStateVariant } from "@/components/ui/empty-state";
import { QUICK_ADD_ACTIONS } from "@/lib/nav-items";

describe("presentation maps", () => {
  it("humanizes roles", () => {
    expect(formatRoleLabel("household_coordinator")).toBe(
      "Household coordinator",
    );
    expect(formatRoleLabel("financial_coordinator")).toBe(
      "Financial coordinator",
    );
    expect(formatRoleLabel("member")).toBe("Member");
  });

  it("humanizes audit events with actor context", () => {
    expect(
      formatAuditEventLabel("shopping.list_created", { isCurrentUser: true }),
    ).toBe("You created a shopping list");
    expect(
      formatAuditEventLabel("recipe.import_extracted", {
        actorName: "Alex",
      }),
    ).toBe("Alex imported recipe details");
  });

  it("humanizes enums and notification categories", () => {
    expect(humanizeEnum("round_robin")).toBe("Round Robin");
    expect(formatNotificationCategory("payments")).toBe("Payments");
    expect(formatNotificationCategory("governance")).toBe("Governance");
  });
});

describe("time and currency helpers", () => {
  it("converts minutes and time inputs", () => {
    expect(minutesToTimeValue(9 * 60 + 30)).toBe("09:30");
    expect(timeValueToMinutes("18:00")).toBe(18 * 60);
    expect(formatMinutesAsTime(0)).toBe("12:00 AM");
    expect(formatMinutesAsTime(13 * 60)).toBe("1:00 PM");
  });

  it("parses and formats currency without floats in storage", () => {
    expect(parseUsdToCents("12.50")).toBe(toCents(1250));
    expect(formatUsdFromCents(toCents(1250))).toBe("$12.50");
    expect(() => parseUsdToCents("abc")).toThrow();
  });
});

describe("home and empty-state helpers", () => {
  it("prioritizes high urgency attention items", () => {
    const ranked = prioritizeAttention([
      {
        id: "1",
        title: "a",
        detail: "",
        urgency: "normal",
        href: "/",
      },
      {
        id: "2",
        title: "b",
        detail: "",
        urgency: "high",
        href: "/",
      },
    ]);
    expect(ranked[0]?.id).toBe("2");
  });

  it("selects empty-state variants", () => {
    expect(selectEmptyStateVariant({ isFullPage: true })).toBe("page");
    expect(selectEmptyStateVariant({ hasSiblingContent: true })).toBe("inline");
    expect(selectEmptyStateVariant({})).toBe("section");
  });

  it("routes quick-add into existing domains", () => {
    const expense = QUICK_ADD_ACTIONS.find((a) => a.key === "expense");
    expect(expense?.href("hh")).toContain("/money/expenses/new");
  });
});
