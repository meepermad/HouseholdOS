import { describe, expect, it } from "vitest";
import {
  activityStatusLabel,
  formatActivityDescription,
  sortActivity,
} from "@/lib/money/activity";

describe("activity formatting", () => {
  it("uses friendly descriptions without raw keys", () => {
    expect(formatActivityDescription("payment_submitted", { member: "Andrew" })).toBe(
      "Payment submitted to Andrew",
    );
    expect(activityStatusLabel("payment_submitted")).toBe("Awaiting confirmation");
  });

  it("sorts newest first", () => {
    const sorted = sortActivity([
      {
        id: "a",
        kind: "expense_created",
        description: "older",
        amountCents: 1,
        secondary: null,
        date: "2026-01-01",
        statusLabel: "Draft",
        href: "/",
        sortAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "b",
        kind: "expense_confirmed",
        description: "newer",
        amountCents: 2,
        secondary: null,
        date: "2026-07-01",
        statusLabel: "Confirmed",
        href: "/",
        sortAt: "2026-07-01T00:00:00Z",
      },
    ]);
    expect(sorted[0]?.id).toBe("b");
  });
});
