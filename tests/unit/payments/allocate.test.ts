import { describe, expect, it } from "vitest";
import {
  PaymentCalcError,
  sortObligationsOldestFirst,
  suggestOldestFirstAllocation,
  validateAllocations,
  type ObligationForAllocation,
} from "@/lib/payments";

function expectCode(fn: () => void, code: string) {
  try {
    fn();
    expect.fail("expected throw");
  } catch (e) {
    expect(e).toBeInstanceOf(PaymentCalcError);
    expect((e as PaymentCalcError).code).toBe(code);
  }
}

const H = "hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh";
const SENDER = "ssssssss-ssss-ssss-ssss-ssssssssssss";
const RECIPIENT = "rrrrrrrr-rrrr-rrrr-rrrr-rrrrrrrrrrrr";
const OTHER = "oooooooo-oooo-oooo-oooo-oooooooooooo";
const H2 = "22222222-2222-2222-2222-222222222222";

function obl(
  overrides: Partial<ObligationForAllocation> &
    Pick<ObligationForAllocation, "id" | "officialOutstandingCents">,
): ObligationForAllocation {
  return {
    householdId: H,
    debtorMembershipId: SENDER,
    creditorMembershipId: RECIPIENT,
    currency: "USD",
    effectiveAmountCents: overrides.officialOutstandingCents,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("payment allocation", () => {
  it("1. one-obligation allocation", () => {
    const o = obl({
      id: "a",
      officialOutstandingCents: 1225,
      effectiveAmountCents: 1225,
    });
    validateAllocations({
      paymentAmountCents: 1225,
      allocations: [{ obligationId: "a", amountCents: 1225 }],
      obligations: [o],
      senderMembershipId: SENDER,
      recipientMembershipId: RECIPIENT,
      householdId: H,
      currency: "USD",
    });
  });

  it("2. multi-obligation allocation", () => {
    const obligations = [
      obl({ id: "a", officialOutstandingCents: 1225 }),
      obl({ id: "b", officialOutstandingCents: 775 }),
      obl({ id: "c", officialOutstandingCents: 1000 }),
    ];
    validateAllocations({
      paymentAmountCents: 3000,
      allocations: [
        { obligationId: "a", amountCents: 1225 },
        { obligationId: "b", amountCents: 775 },
        { obligationId: "c", amountCents: 1000 },
      ],
      obligations,
      senderMembershipId: SENDER,
      recipientMembershipId: RECIPIENT,
      householdId: H,
      currency: "USD",
    });
  });

  it("3. partial payment", () => {
    const o = obl({ id: "a", officialOutstandingCents: 4000 });
    validateAllocations({
      paymentAmountCents: 1500,
      allocations: [{ obligationId: "a", amountCents: 1500 }],
      obligations: [o],
      senderMembershipId: SENDER,
      recipientMembershipId: RECIPIENT,
      householdId: H,
      currency: "USD",
    });
  });

  it("4. exact full settlement", () => {
    const obligations = [
      obl({ id: "a", officialOutstandingCents: 500 }),
      obl({ id: "b", officialOutstandingCents: 500 }),
    ];
    const suggested = suggestOldestFirstAllocation({
      paymentAmountCents: 1000,
      obligations,
      senderMembershipId: SENDER,
      recipientMembershipId: RECIPIENT,
      householdId: H,
      currency: "USD",
    });
    expect(suggested.reduce((s, l) => s + l.amountCents, 0)).toBe(1000);
    validateAllocations({
      paymentAmountCents: 1000,
      allocations: suggested,
      obligations,
      senderMembershipId: SENDER,
      recipientMembershipId: RECIPIENT,
      householdId: H,
      currency: "USD",
    });
  });

  it("5. oldest-first automatic allocation", () => {
    const obligations = [
      obl({
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        officialOutstandingCents: 1000,
        createdAt: "2026-01-02T00:00:00.000Z",
      }),
      obl({
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        officialOutstandingCents: 800,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
      obl({
        id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        officialOutstandingCents: 500,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    ];
    const suggested = suggestOldestFirstAllocation({
      paymentAmountCents: 1500,
      obligations,
      senderMembershipId: SENDER,
      recipientMembershipId: RECIPIENT,
      householdId: H,
      currency: "USD",
    });
    // Same day: UUID a then c, then next day b
    expect(suggested).toEqual([
      { obligationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", amountCents: 800 },
      { obligationId: "cccccccc-cccc-cccc-cccc-cccccccccccc", amountCents: 500 },
      { obligationId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", amountCents: 200 },
    ]);
  });

  it("6. manual allocation override", () => {
    const obligations = [
      obl({ id: "a", officialOutstandingCents: 1000, createdAt: "2026-01-01T00:00:00.000Z" }),
      obl({ id: "b", officialOutstandingCents: 1000, createdAt: "2026-01-02T00:00:00.000Z" }),
    ];
    // Auto would prefer a; manual prefers b first partially.
    validateAllocations({
      paymentAmountCents: 700,
      allocations: [{ obligationId: "b", amountCents: 700 }],
      obligations,
      senderMembershipId: SENDER,
      recipientMembershipId: RECIPIENT,
      householdId: H,
      currency: "USD",
    });
  });

  it("7. allocation sum mismatch", () => {
    expect(() =>
      validateAllocations({
        paymentAmountCents: 1000,
        allocations: [{ obligationId: "a", amountCents: 900 }],
        obligations: [obl({ id: "a", officialOutstandingCents: 1000 })],
        senderMembershipId: SENDER,
        recipientMembershipId: RECIPIENT,
        householdId: H,
        currency: "USD",
      }),
    ).toThrow(PaymentCalcError);
    try {
      validateAllocations({
        paymentAmountCents: 1000,
        allocations: [{ obligationId: "a", amountCents: 900 }],
        obligations: [obl({ id: "a", officialOutstandingCents: 1000 })],
        senderMembershipId: SENDER,
        recipientMembershipId: RECIPIENT,
        householdId: H,
        currency: "USD",
      });
    } catch (e) {
      expect((e as PaymentCalcError).code).toBe("allocation_sum_mismatch");
    }
  });

  it("8. payment greater than outstanding", () => {
    expectCode(
      () =>
        suggestOldestFirstAllocation({
          paymentAmountCents: 2000,
          obligations: [obl({ id: "a", officialOutstandingCents: 500 })],
          senderMembershipId: SENDER,
          recipientMembershipId: RECIPIENT,
          householdId: H,
          currency: "USD",
        }),
      "payment_greater_than_outstanding",
    );
  });

  it("9. cross-recipient allocation", () => {
    expectCode(
      () =>
        validateAllocations({
          paymentAmountCents: 100,
          allocations: [{ obligationId: "a", amountCents: 100 }],
          obligations: [
            obl({
              id: "a",
              officialOutstandingCents: 100,
              creditorMembershipId: OTHER,
            }),
          ],
          senderMembershipId: SENDER,
          recipientMembershipId: RECIPIENT,
          householdId: H,
          currency: "USD",
        }),
      "cross_recipient_allocation",
    );
  });

  it("10. cross-household allocation", () => {
    expectCode(
      () =>
        validateAllocations({
          paymentAmountCents: 100,
          allocations: [{ obligationId: "a", amountCents: 100 }],
          obligations: [
            obl({
              id: "a",
              officialOutstandingCents: 100,
              householdId: H2,
            }),
          ],
          senderMembershipId: SENDER,
          recipientMembershipId: RECIPIENT,
          householdId: H,
          currency: "USD",
        }),
      "cross_household_allocation",
    );
  });

  it("19. stable allocation ordering", () => {
    const a = [
      obl({ id: "z", officialOutstandingCents: 1, createdAt: "2026-01-01T00:00:00.000Z" }),
      obl({ id: "a", officialOutstandingCents: 1, createdAt: "2026-01-01T00:00:00.000Z" }),
    ];
    const b = [...a].reverse();
    expect(sortObligationsOldestFirst(a).map((o) => o.id)).toEqual(
      sortObligationsOldestFirst(b).map((o) => o.id),
    );
  });

  it("25. currency mismatch", () => {
    expectCode(
      () =>
        validateAllocations({
          paymentAmountCents: 100,
          allocations: [{ obligationId: "a", amountCents: 100 }],
          obligations: [
            obl({ id: "a", officialOutstandingCents: 100, currency: "EUR" }),
          ],
          senderMembershipId: SENDER,
          recipientMembershipId: RECIPIENT,
          householdId: H,
          currency: "USD",
        }),
      "currency_mismatch",
    );
  });

  it("26. safe integer limits", () => {
    expectCode(
      () =>
        validateAllocations({
          paymentAmountCents: 1_000_000_001,
          allocations: [{ obligationId: "a", amountCents: 1_000_000_001 }],
          obligations: [
            obl({ id: "a", officialOutstandingCents: 1_000_000_001 }),
          ],
          senderMembershipId: SENDER,
          recipientMembershipId: RECIPIENT,
          householdId: H,
          currency: "USD",
        }),
      "unsafe_integer",
    );
  });

  it("allocation exceeds outstanding", () => {
    expectCode(
      () =>
        validateAllocations({
          paymentAmountCents: 500,
          allocations: [{ obligationId: "a", amountCents: 500 }],
          obligations: [obl({ id: "a", officialOutstandingCents: 100 })],
          senderMembershipId: SENDER,
          recipientMembershipId: RECIPIENT,
          householdId: H,
          currency: "USD",
        }),
      "allocation_exceeds_outstanding",
    );
  });
});
