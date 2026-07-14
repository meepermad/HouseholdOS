import { describe, expect, it } from "vitest";
import {
  calculateExpense,
  calculateExpenseOrThrow,
  splitEvenlyDeterministic,
} from "@/lib/expenses";
import type { CalculateExpenseInput } from "@/lib/expenses";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const D = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const ALL = [A, B, C, D] as const;

function base(
  overrides: Partial<CalculateExpenseInput> &
    Pick<CalculateExpenseInput, "declaredTotalCents" | "items" | "adjustments">,
): CalculateExpenseInput {
  return {
    payerMembershipId: A,
    eligibleMembershipIds: [...ALL],
    currency: "USD",
    householdCurrency: "USD",
    ...overrides,
  };
}

describe("deterministic equal split rounding", () => {
  it("four-way equal split divisible evenly", () => {
    const parts = splitEvenlyDeterministic(1000, ALL);
    expect(parts.every((p) => p.amountCents === 250)).toBe(true);
    expect(parts.reduce((s, p) => s + p.amountCents, 0)).toBe(1000);
  });

  it("four-way equal split with remainder cents is stable", () => {
    const parts = splitEvenlyDeterministic(100, ALL);
    expect(parts.reduce((s, p) => s + p.amountCents, 0)).toBe(100);
    // UUID ascending: A,B,C,D — remainders 100/4=25 exact, so even.
    expect(parts.map((p) => p.amountCents)).toEqual([25, 25, 25, 25]);

    const odd = splitEvenlyDeterministic(101, ALL);
    expect(odd.reduce((s, p) => s + p.amountCents, 0)).toBe(101);
    // exact=25.25 each; floor=25; remainder 1 → largest fraction ties → UUID A first
    expect(odd.find((p) => p.membershipId === A)?.amountCents).toBe(26);
    expect(odd.filter((p) => p.amountCents === 25)).toHaveLength(3);

    // Stability: reverse input order yields same assignment
    const oddRev = splitEvenlyDeterministic(101, [...ALL].reverse());
    expect(oddRev).toEqual(odd);
  });
});

describe("calculateExpense item modes", () => {
  it("equal split among selected members", () => {
    const result = calculateExpenseOrThrow(
      base({
        declaredTotalCents: 900,
        items: [
          {
            id: "i1",
            description: "Shared among B,C,D",
            totalCents: 900,
            allocationMode: "equal_selected",
            participants: [{ membershipId: B }, { membershipId: C }, { membershipId: D }],
          },
        ],
        adjustments: [],
      }),
    );
    expect(result.memberShares.find((m) => m.membershipId === B)?.totalShareCents).toBe(300);
    expect(result.obligations).toHaveLength(3);
    expect(result.obligations.every((o) => o.creditorMembershipId === A)).toBe(true);
  });

  it("personal item assigned to payer creates no obligation", () => {
    const result = calculateExpenseOrThrow(
      base({
        declaredTotalCents: 500,
        items: [
          {
            id: "i1",
            description: "Payer shampoo",
            totalCents: 500,
            allocationMode: "personal",
            personalMembershipId: A,
          },
        ],
        adjustments: [],
      }),
    );
    expect(result.obligations).toHaveLength(0);
    expect(result.memberShares.find((m) => m.membershipId === A)?.totalShareCents).toBe(500);
  });

  it("personal item assigned to non-payer creates full obligation", () => {
    const result = calculateExpenseOrThrow(
      base({
        declaredTotalCents: 500,
        items: [
          {
            id: "i1",
            description: "B protein",
            totalCents: 500,
            allocationMode: "personal",
            personalMembershipId: B,
          },
        ],
        adjustments: [],
      }),
    );
    expect(result.obligations).toEqual([
      expect.objectContaining({
        debtorMembershipId: B,
        creditorMembershipId: A,
        amountCents: 500,
      }),
    ]);
  });

  it("excluded item creates no allocations or obligations", () => {
    const result = calculateExpenseOrThrow(
      base({
        declaredTotalCents: 400,
        items: [
          {
            id: "i1",
            description: "Non-reimbursable",
            totalCents: 400,
            allocationMode: "excluded",
          },
        ],
        adjustments: [],
      }),
    );
    expect(result.lines[0]?.excluded).toBe(true);
    expect(result.obligations).toHaveLength(0);
    expect(result.reconciled).toBe(true);
  });

  it("fixed-cent split", () => {
    const result = calculateExpenseOrThrow(
      base({
        declaredTotalCents: 1000,
        items: [
          {
            id: "i1",
            description: "Fixed",
            totalCents: 1000,
            allocationMode: "fixed_cents",
            participants: [
              { membershipId: A, fixedCents: 100 },
              { membershipId: B, fixedCents: 200 },
              { membershipId: C, fixedCents: 300 },
              { membershipId: D, fixedCents: 400 },
            ],
          },
        ],
        adjustments: [],
      }),
    );
    expect(result.memberShares.find((m) => m.membershipId === D)?.totalShareCents).toBe(400);
    expect(result.obligations.find((o) => o.debtorMembershipId === D)?.amountCents).toBe(400);
  });

  it("percentage split", () => {
    const result = calculateExpenseOrThrow(
      base({
        declaredTotalCents: 1000,
        items: [
          {
            id: "i1",
            description: "Percent",
            totalCents: 1000,
            allocationMode: "percentage",
            participants: [
              { membershipId: A, percentBps: 2500 },
              { membershipId: B, percentBps: 2500 },
              { membershipId: C, percentBps: 2500 },
              { membershipId: D, percentBps: 2500 },
            ],
          },
        ],
        adjustments: [],
      }),
    );
    expect(result.memberShares.every((m) => m.totalShareCents === 250)).toBe(true);
  });

  it("weighted split", () => {
    // A:2 B:2 C:1 D:1 → total 6 shares of 1200 = 200 per share
    const result = calculateExpenseOrThrow(
      base({
        declaredTotalCents: 1200,
        items: [
          {
            id: "i1",
            description: "Weighted",
            totalCents: 1200,
            allocationMode: "weighted",
            participants: [
              { membershipId: A, weight: 2 },
              { membershipId: B, weight: 2 },
              { membershipId: C, weight: 1 },
              { membershipId: D, weight: 1 },
            ],
          },
        ],
        adjustments: [],
      }),
    );
    expect(result.memberShares.find((m) => m.membershipId === A)?.totalShareCents).toBe(400);
    expect(result.memberShares.find((m) => m.membershipId === C)?.totalShareCents).toBe(200);
  });
});

describe("calculateExpense adjustments", () => {
  it("proportional tax", () => {
    // Items: A 600 personal, B 400 personal; tax 100 proportional
    const result = calculateExpenseOrThrow(
      base({
        declaredTotalCents: 1100,
        items: [
          {
            id: "i1",
            description: "A stuff",
            totalCents: 600,
            allocationMode: "personal",
            personalMembershipId: A,
          },
          {
            id: "i2",
            description: "B stuff",
            totalCents: 400,
            allocationMode: "personal",
            personalMembershipId: B,
          },
        ],
        adjustments: [
          {
            id: "tax",
            description: "Sales tax",
            type: "tax",
            amountCents: 100,
            allocationMode: "proportional",
          },
        ],
      }),
    );
    // A basis 600/1000 → 60 tax; B 40 tax
    expect(result.memberShares.find((m) => m.membershipId === A)?.totalShareCents).toBe(660);
    expect(result.memberShares.find((m) => m.membershipId === B)?.totalShareCents).toBe(440);
    expect(result.obligations.find((o) => o.debtorMembershipId === B)?.amountCents).toBe(440);
  });

  it("equal delivery fee", () => {
    const result = calculateExpenseOrThrow(
      base({
        declaredTotalCents: 1080,
        items: [
          {
            id: "i1",
            description: "Equal food",
            totalCents: 1000,
            allocationMode: "equal_all",
          },
        ],
        adjustments: [
          {
            id: "del",
            description: "Delivery",
            type: "delivery_fee",
            amountCents: 80,
            allocationMode: "equal_all",
          },
        ],
      }),
    );
    expect(result.memberShares.every((m) => m.totalShareCents === 270)).toBe(true);
  });

  it("payer-absorbed tip", () => {
    const result = calculateExpenseOrThrow(
      base({
        declaredTotalCents: 1100,
        items: [
          {
            id: "i1",
            description: "Equal",
            totalCents: 1000,
            allocationMode: "equal_all",
          },
        ],
        adjustments: [
          {
            id: "tip",
            description: "Tip",
            type: "tip",
            amountCents: 100,
            allocationMode: "payer_absorbs",
          },
        ],
      }),
    );
    expect(result.memberShares.find((m) => m.membershipId === A)?.totalShareCents).toBe(350);
    expect(result.memberShares.find((m) => m.membershipId === B)?.totalShareCents).toBe(250);
    expect(result.obligations.find((o) => o.debtorMembershipId === B)?.amountCents).toBe(250);
  });

  it("proportional discount", () => {
    const result = calculateExpenseOrThrow(
      base({
        declaredTotalCents: 900,
        items: [
          {
            id: "i1",
            description: "A",
            totalCents: 600,
            allocationMode: "personal",
            personalMembershipId: A,
          },
          {
            id: "i2",
            description: "B",
            totalCents: 400,
            allocationMode: "personal",
            personalMembershipId: B,
          },
        ],
        adjustments: [
          {
            id: "disc",
            description: "Coupon",
            type: "discount",
            amountCents: -100,
            allocationMode: "proportional",
          },
        ],
      }),
    );
    expect(result.memberShares.find((m) => m.membershipId === A)?.totalShareCents).toBe(540);
    expect(result.memberShares.find((m) => m.membershipId === B)?.totalShareCents).toBe(360);
  });

  it("discount larger than one member positive share flips obligation", () => {
    // B has 50 personal; huge discount assigned entirely to B (-200)
    const result = calculateExpenseOrThrow(
      base({
        declaredTotalCents: 850,
        items: [
          {
            id: "i1",
            description: "A bulk",
            totalCents: 1000,
            allocationMode: "personal",
            personalMembershipId: A,
          },
          {
            id: "i2",
            description: "B tiny",
            totalCents: 50,
            allocationMode: "personal",
            personalMembershipId: B,
          },
        ],
        adjustments: [
          {
            id: "disc",
            description: "Store credit to B",
            type: "store_credit",
            amountCents: -200,
            allocationMode: "assigned",
            assignedMembershipId: B,
          },
        ],
      }),
    );
    // B net = 50 - 200 = -150 → payer owes B 150
    expect(result.memberShares.find((m) => m.membershipId === B)?.totalShareCents).toBe(-150);
    expect(
      result.obligations.find(
        (o) => o.debtorMembershipId === A && o.creditorMembershipId === B,
      )?.amountCents,
    ).toBe(150);
  });

  it("zero-value adjustment", () => {
    const result = calculateExpenseOrThrow(
      base({
        declaredTotalCents: 100,
        items: [
          {
            id: "i1",
            description: "Item",
            totalCents: 100,
            allocationMode: "personal",
            personalMembershipId: A,
          },
        ],
        adjustments: [
          {
            id: "z",
            description: "Zero tip",
            type: "tip",
            amountCents: 0,
            allocationMode: "payer_absorbs",
          },
        ],
      }),
    );
    expect(result.reconciled).toBe(true);
    expect(result.adjustmentsNetCents).toBe(0);
  });

  it("multiple adjustments", () => {
    const result = calculateExpenseOrThrow(
      base({
        declaredTotalCents: 1150,
        items: [
          {
            id: "i1",
            description: "Equal",
            totalCents: 1000,
            allocationMode: "equal_all",
          },
        ],
        adjustments: [
          {
            id: "tax",
            description: "Tax",
            type: "tax",
            amountCents: 80,
            allocationMode: "proportional",
          },
          {
            id: "tip",
            description: "Tip",
            type: "tip",
            amountCents: 100,
            allocationMode: "payer_absorbs",
          },
          {
            id: "disc",
            description: "Disc",
            type: "discount",
            amountCents: -30,
            allocationMode: "equal_all",
          },
        ],
      }),
    );
    expect(result.calculatedTotalCents).toBe(1150);
    expect(result.obligations.every((o) => o.amountCents > 0)).toBe(true);
  });
});

describe("calculateExpense mixed and invariants", () => {
  it("mixed personal and shared items", () => {
    const result = calculateExpenseOrThrow(
      base({
        declaredTotalCents: 1500,
        items: [
          {
            id: "i1",
            description: "Shared TP",
            totalCents: 800,
            allocationMode: "equal_all",
          },
          {
            id: "i2",
            description: "A personal",
            totalCents: 300,
            allocationMode: "personal",
            personalMembershipId: A,
          },
          {
            id: "i3",
            description: "B personal",
            totalCents: 400,
            allocationMode: "personal",
            personalMembershipId: B,
          },
        ],
        adjustments: [],
      }),
    );
    // A: 200 + 300 = 500; B: 200 + 400 = 600; C: 200; D: 200
    expect(result.memberShares.find((m) => m.membershipId === A)?.totalShareCents).toBe(500);
    expect(result.memberShares.find((m) => m.membershipId === B)?.totalShareCents).toBe(600);
    expect(result.obligations.find((o) => o.debtorMembershipId === B)?.amountCents).toBe(600);
    expect(result.obligations.find((o) => o.debtorMembershipId === A)).toBeUndefined();
  });

  it("exact reconciliation succeeds", () => {
    const result = calculateExpense(
      base({
        declaredTotalCents: 500,
        items: [
          {
            id: "i1",
            description: "X",
            totalCents: 500,
            allocationMode: "personal",
            personalMembershipId: A,
          },
        ],
        adjustments: [],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.reconciled).toBe(true);
  });

  it("reconciliation failure", () => {
    const result = calculateExpense(
      base({
        declaredTotalCents: 999,
        items: [
          {
            id: "i1",
            description: "X",
            totalCents: 500,
            allocationMode: "personal",
            personalMembershipId: A,
          },
        ],
        adjustments: [],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("reconciliation_failure");
  });

  it("currency mismatch", () => {
    const result = calculateExpense(
      base({
        currency: "EUR",
        householdCurrency: "USD",
        declaredTotalCents: 100,
        items: [
          {
            id: "i1",
            description: "X",
            totalCents: 100,
            allocationMode: "personal",
            personalMembershipId: A,
          },
        ],
        adjustments: [],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("currency_mismatch");
  });

  it("payer self-share exclusion from obligations", () => {
    const result = calculateExpenseOrThrow(
      base({
        declaredTotalCents: 1000,
        items: [
          {
            id: "i1",
            description: "Equal",
            totalCents: 1000,
            allocationMode: "equal_all",
          },
        ],
        adjustments: [],
      }),
    );
    expect(result.obligations.every((o) => o.debtorMembershipId !== A)).toBe(true);
    expect(result.obligations.every((o) => o.debtorMembershipId !== o.creditorMembershipId)).toBe(
      true,
    );
  });

  it("stable deterministic rounding across runs", () => {
    const input = base({
      declaredTotalCents: 101,
      items: [
        {
          id: "i1",
          description: "Odd",
          totalCents: 101,
          allocationMode: "equal_all",
        },
      ],
      adjustments: [],
    });
    const a = calculateExpenseOrThrow(input);
    const b = calculateExpenseOrThrow(input);
    expect(a.memberShares).toEqual(b.memberShares);
    expect(a.obligations).toEqual(b.obligations);
  });

  it("large but safe integer values", () => {
    const big = 2_147_483_600; // under 2^31-1
    const result = calculateExpenseOrThrow(
      base({
        declaredTotalCents: big,
        items: [
          {
            id: "i1",
            description: "Big",
            totalCents: big,
            allocationMode: "equal_all",
          },
        ],
        adjustments: [],
      }),
    );
    expect(result.memberShares.reduce((s, m) => s + m.totalShareCents, 0)).toBe(big);
  });

  it("invalid allocation target rejected", () => {
    const result = calculateExpense(
      base({
        declaredTotalCents: 100,
        items: [
          {
            id: "i1",
            description: "Bad",
            totalCents: 100,
            allocationMode: "personal",
            personalMembershipId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
          },
        ],
        adjustments: [],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_allocation_target");
  });

  it("invalid fixed total rejected", () => {
    const result = calculateExpense(
      base({
        declaredTotalCents: 100,
        items: [
          {
            id: "i1",
            description: "Bad fixed",
            totalCents: 100,
            allocationMode: "fixed_cents",
            participants: [
              { membershipId: A, fixedCents: 40 },
              { membershipId: B, fixedCents: 40 },
            ],
          },
        ],
        adjustments: [],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_fixed_total");
  });

  it("invalid percentage total rejected", () => {
    const result = calculateExpense(
      base({
        declaredTotalCents: 100,
        items: [
          {
            id: "i1",
            description: "Bad pct",
            totalCents: 100,
            allocationMode: "percentage",
            participants: [
              { membershipId: A, percentBps: 5000 },
              { membershipId: B, percentBps: 4000 },
            ],
          },
        ],
        adjustments: [],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_percentage_total");
  });

  it("excluded item participates in proportional basis as payer", () => {
    const result = calculateExpenseOrThrow(
      base({
        declaredTotalCents: 1100,
        items: [
          {
            id: "ex",
            description: "Excluded wine",
            totalCents: 1000,
            allocationMode: "excluded",
          },
          {
            id: "shared",
            description: "Shared chips",
            totalCents: 0,
            allocationMode: "equal_all",
          },
        ],
        adjustments: [
          {
            id: "tax",
            description: "Tax",
            type: "tax",
            amountCents: 100,
            allocationMode: "proportional",
          },
        ],
      }),
    );
    // basis is all on payer from excluded → tax all on payer
    expect(result.memberShares.find((m) => m.membershipId === A)?.adjustmentCents).toBe(100);
    expect(result.obligations).toHaveLength(0);
  });

  it("obligation explanation lines are present", () => {
    const result = calculateExpenseOrThrow(
      base({
        declaredTotalCents: 550,
        items: [
          {
            id: "tp",
            description: "Toilet paper",
            totalCents: 450,
            allocationMode: "equal_selected",
            participants: [{ membershipId: B }, { membershipId: A }],
          },
          {
            id: "soap",
            description: "Dish soap",
            totalCents: 100,
            allocationMode: "equal_selected",
            participants: [{ membershipId: B }, { membershipId: A }],
          },
        ],
        adjustments: [],
      }),
    );
    const obl = result.obligations.find((o) => o.debtorMembershipId === B);
    expect(obl?.lines.length).toBeGreaterThanOrEqual(2);
    expect(obl?.amountCents).toBe(275);
  });
});
