import { describe, expect, it } from "vitest";
import {
  expenseStatusCopy,
  expenseWaitingCopy,
  humanStatusLabel,
  paymentMethodLabel,
  timeOfDayGreeting,
} from "@/lib/presentation/human-status";

describe("human-status", () => {
  it("never returns raw enum strings", () => {
    expect(humanStatusLabel("ready_for_review")).toBe("Waiting for confirmation");
    expect(humanStatusLabel("receipt_claiming")).not.toBe("receipt_claiming");
    expect(humanStatusLabel("awaiting_confirmation")).toBe(
      "Waiting for confirmation",
    );
    expect(humanStatusLabel("failed_delivery")).toBe(
      "Could not send notification",
    );
  });

  it("explains expense waiting in roommate language", () => {
    expect(
      expenseWaitingCopy({
        status: "ready_for_review",
        isPayer: false,
        payerLabel: "Henry",
      }),
    ).toBe("Waiting for you to confirm Henry's purchase.");
    expect(expenseStatusCopy("voided").label).toBe("Cancelled");
  });

  it("labels payment methods without snake_case", () => {
    expect(paymentMethodLabel("apple_cash")).toBe("Apple Cash");
    expect(paymentMethodLabel("bank_transfer")).toBe("Bank transfer");
  });

  it("greets by time of day", () => {
    expect(timeOfDayGreeting(new Date("2026-09-04T09:00:00"))).toBe(
      "Good morning",
    );
    expect(timeOfDayGreeting(new Date("2026-09-04T15:00:00"))).toBe(
      "Good afternoon",
    );
    expect(timeOfDayGreeting(new Date("2026-09-04T20:00:00"))).toBe(
      "Good evening",
    );
  });
});
