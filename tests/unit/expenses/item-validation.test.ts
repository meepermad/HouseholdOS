import { describe, expect, it } from "vitest";
import {
  humanizeExpenseValidationError,
  upsertExpenseItemSchema,
} from "@/lib/validations/expenses";

const householdId = "11111111-1111-4111-8111-111111111111";
const expenseId = "22222222-2222-4222-8222-222222222222";
const memberA = "33333333-3333-4333-8333-333333333333";
const memberB = "44444444-4444-4444-8444-444444444444";

function parseItem(overrides: Record<string, unknown> = {}) {
  return upsertExpenseItemSchema.safeParse({
    householdId,
    expenseId,
    description: "Milk",
    quantityLabel: "",
    totalCents: "1250",
    displayOrder: "0",
    allocationMode: "equal_selected",
    personalMembershipId: null,
    excludeFromAdjustmentBasis: null,
    participants: [{ membershipId: memberA }, { membershipId: memberB }],
    ...overrides,
  });
}

describe("equal-selected expense item validation", () => {
  it("accepts a split between some people when members are selected", () => {
    const parsed = parseItem();
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.allocationMode).toBe("equal_selected");
      expect(parsed.data.participants.map((p) => p.membershipId)).toEqual([
        memberA,
        memberB,
      ]);
      expect(parsed.data.totalCents).toBe(1250);
    }
  });

  it("accepts a missing allocation checkbox (FormData null)", () => {
    const parsed = parseItem({
      allocationMode: "equal_all",
      participants: [],
      excludeFromAdjustmentBasis: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("asks the member to choose people instead of returning Invalid input", () => {
    const parsed = parseItem({ participants: [] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const message = humanizeExpenseValidationError(
        parsed.error,
        "This line item could not be saved.",
      );
      expect(message).toBe("Choose at least one person to share this with.");
      expect(message).not.toMatch(/invalid input/i);
      expect(JSON.stringify(parsed.error.issues)).not.toMatch(/Invalid input$/);
    }
  });

  it("ignores leftover null allocation fields on equal_selected participants", () => {
    const parsed = parseItem({
      participants: [
        {
          membershipId: memberA,
          fixedCents: null,
          percentBps: null,
          weight: null,
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});
