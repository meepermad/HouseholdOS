import { describe, expect, it } from "vitest";
import {
  BalanceReconciliationError,
  buildBalanceExplanation,
  type ExplanationLineInput,
} from "@/lib/money/balance-explanation";

const H = "hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh";
const ATEM = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ANDREW = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const OTHER_HOUSE = "iiiiiiii-iiii-iiii-iiii-iiiiiiiiiiii";

function line(partial: Partial<ExplanationLineInput> & { id: string }): ExplanationLineInput {
  const effective = partial.effectiveAmountCents ?? 8000;
  const paid = partial.confirmedPaidCents ?? 0;
  const waived = partial.waivedCents ?? 0;
  return {
    householdId: H,
    label: "Walmart",
    debtorMembershipId: ANDREW,
    creditorMembershipId: ATEM,
    obligationKind: "reimbursement",
    hasReceipt: true,
    originalAmountCents: effective,
    effectiveAmountCents: effective,
    confirmedPaidCents: paid,
    pendingPaymentCents: 0,
    waivedCents: waived,
    officialOutstandingCents: Math.max(0, effective - paid - waived),
    storedStatus: "active",
    href: `/obligations/${partial.id}`,
    receiptHref: "/receipts/1",
    ...partial,
  };
}

describe("balance explanation reconciliation", () => {
  it("reconciles receipts, an opening balance, an adjustment, and partial payments", () => {
    const explanation = buildBalanceExplanation({
      viewerMembershipId: ATEM,
      counterpartyMembershipId: ANDREW,
      counterpartyName: "Andrew",
      lines: [
        line({
          id: "walmart",
          label: "Walmart",
          effectiveAmountCents: 2850,
          originalAmountCents: 2850,
          confirmedPaidCents: 0,
          officialOutstandingCents: 2850,
          payments: [],
        }),
        line({
          id: "electric",
          label: "Electricity",
          hasReceipt: false,
          effectiveAmountCents: 3500,
          originalAmountCents: 3500,
          confirmedPaidCents: 0,
          officialOutstandingCents: 3500,
        }),
        line({
          id: "opening",
          label: "Starting balance",
          obligationKind: "opening_balance",
          hasReceipt: false,
          receiptHref: null,
          effectiveAmountCents: 2000,
          originalAmountCents: 2000,
          confirmedPaidCents: 0,
          officialOutstandingCents: 2000,
        }),
        line({
          id: "adjusted",
          label: "Supplies",
          hasReceipt: true,
          effectiveAmountCents: 1275,
          originalAmountCents: 1500,
          waivedCents: 0,
          confirmedPaidCents: 3500 > 1275 ? 0 : 0,
          officialOutstandingCents: 1275,
        }),
        line({
          id: "partial",
          label: "ALDI",
          effectiveAmountCents: 8000,
          originalAmountCents: 8000,
          confirmedPaidCents: 3500,
          officialOutstandingCents: 4500,
          payments: [
            {
              id: "pay-1",
              label: "September 20",
              amountCents: 3500,
              href: "/payments/pay-1",
              status: "confirmed",
            },
          ],
        }),
      ],
    });

    const remaining = explanation.linesTheyOwe.reduce((sum, row) => sum + row.remainingCents, 0);
    expect(remaining).toBe(explanation.theyOweYouCents);
    expect(explanation.theyOweYouCents).toBe(2850 + 3500 + 2000 + 1275 + 4500);
    expect(explanation.linesTheyOwe.find((row) => row.id === "opening")?.sourceKind).toBe(
      "opening_balance",
    );
    expect(explanation.linesTheyOwe.find((row) => row.id === "opening")?.sourceNote).toMatch(
      /No receipt/i,
    );
    expect(explanation.linesTheyOwe.find((row) => row.id === "partial")?.paidCents).toBe(3500);
    expect(explanation.linesTheyOwe.find((row) => row.id === "partial")?.remainingCents).toBe(4500);
  });

  it("shows original obligations and a suggested net without inventing a receipt", () => {
    const explanation = buildBalanceExplanation({
      viewerMembershipId: ATEM,
      counterpartyMembershipId: ANDREW,
      counterpartyName: "Andrew",
      lines: [
        line({
          id: "andrew-owes",
          debtorMembershipId: ANDREW,
          creditorMembershipId: ATEM,
          effectiveAmountCents: 3000,
          originalAmountCents: 3000,
          officialOutstandingCents: 3000,
        }),
        line({
          id: "atem-owes",
          debtorMembershipId: ATEM,
          creditorMembershipId: ANDREW,
          effectiveAmountCents: 1000,
          originalAmountCents: 1000,
          officialOutstandingCents: 1000,
          hasReceipt: false,
        }),
      ],
    });
    expect(explanation.theyOweYouCents).toBe(3000);
    expect(explanation.youOweCents).toBe(1000);
    expect(explanation.netCents).toBe(-2000);
    expect(explanation.netSentence).toMatch(/Andrew pays you/);
  });

  it("fails when the displayed remaining does not match the ledger", () => {
    expect(() =>
      buildBalanceExplanation({
        viewerMembershipId: ATEM,
        counterpartyMembershipId: ANDREW,
        counterpartyName: "Andrew",
        lines: [
          line({
            id: "bad",
            effectiveAmountCents: 1000,
            confirmedPaidCents: 0,
            officialOutstandingCents: 999,
          }),
        ],
      }),
    ).toThrow(BalanceReconciliationError);
  });

  it("does not mix households", () => {
    expect(() =>
      buildBalanceExplanation({
        viewerMembershipId: ATEM,
        counterpartyMembershipId: ANDREW,
        counterpartyName: "Andrew",
        lines: [
          line({ id: "one" }),
          line({ id: "two", householdId: OTHER_HOUSE }),
        ],
      }),
    ).toThrow(/more than one household/i);
  });

  it("does not double-count a reversal", () => {
    const explanation = buildBalanceExplanation({
      viewerMembershipId: ATEM,
      counterpartyMembershipId: ANDREW,
      counterpartyName: "Andrew",
      lines: [
        line({
          id: "reversed",
          storedStatus: "reversed",
          effectiveAmountCents: 5000,
          confirmedPaidCents: 5000,
          officialOutstandingCents: 0,
        }),
      ],
    });
    expect(explanation.theyOweYouCents).toBe(0);
    expect(explanation.linesTheyOwe[0]?.remainingCents).toBe(0);
  });
});
