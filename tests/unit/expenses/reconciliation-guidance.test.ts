import { describe, expect, it } from "vitest";
import { describeReconciliation } from "@/lib/expenses/reconciliation-guidance";

describe("describeReconciliation", () => {
  it("reports the shortfall when the lines do not cover the receipt total", () => {
    const guidance = describeReconciliation({
      code: "reconciliation_failure",
      message: "Calculated total 4200 does not match declared total 4650",
      declaredTotalCents: 4650,
      calculatedTotalCents: 4200,
    });

    expect(guidance.title).toBe("Totals do not match yet");
    expect(guidance.differenceCents).toBe(450);
    expect(guidance.options[0]).toContain("$4.50");
    expect(guidance.options[1]).toContain("$42.00");
  });

  it("reports the overage when the lines exceed the receipt total", () => {
    const guidance = describeReconciliation({
      code: "reconciliation_failure",
      message: "mismatch",
      declaredTotalCents: 1000,
      calculatedTotalCents: 1250,
    });

    expect(guidance.differenceCents).toBe(-250);
    expect(guidance.options[0]).toContain("Remove or reduce $2.50");
  });

  it("offers no difference when the totals agree but a line is incomplete", () => {
    const guidance = describeReconciliation({
      code: "empty_participants",
      message: "Equal-selected split requires participants",
      declaredTotalCents: 1000,
      calculatedTotalCents: 1000,
    });

    expect(guidance.title).toBe("Not ready to confirm");
    expect(guidance.differenceCents).toBeNull();
    expect(guidance.explanation).toContain("nobody is selected");
    expect(guidance.options).toEqual(["Open the line below and finish its split."]);
  });

  it("explains a missing personal owner in plain language", () => {
    const guidance = describeReconciliation({
      code: "incomplete_allocation",
      message: "Personal items require an owner membership",
      declaredTotalCents: 500,
      calculatedTotalCents: 500,
    });

    expect(guidance.explanation).toContain("without an owner");
  });

  it("falls back to the engine message for unmapped codes", () => {
    const guidance = describeReconciliation({
      code: "zero_basis",
      message: "raw engine text",
      declaredTotalCents: 0,
    });

    expect(guidance.differenceCents).toBeNull();
    expect(guidance.explanation).toContain("in proportion to items");
  });
});
