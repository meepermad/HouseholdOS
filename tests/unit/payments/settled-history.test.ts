import { describe, expect, it } from "vitest";
import { settledRelationships } from "@/lib/payments/settled-history";

const viewer = "viewer";

describe("settled relationships", () => {
  it("keeps a zero-balance relationship available after every obligation is settled", () => {
    const settled = settledRelationships({
      viewerMembershipId: viewer,
      obligations: [
        {
          obligation_id: "obl-b",
          debtor_membership_id: "andrew",
          creditor_membership_id: viewer,
          expense_id: "exp-2",
          obligation_kind: "reimbursement",
          official_outstanding_cents: 0,
          pending_payment_cents: 0,
        },
        {
          obligation_id: "obl-a",
          debtor_membership_id: "andrew",
          creditor_membership_id: viewer,
          expense_id: "exp-1",
          obligation_kind: "reimbursement",
          official_outstanding_cents: 0,
          pending_payment_cents: 0,
        },
      ],
    });
    expect(settled).toEqual([
      {
        counterpartyMembershipId: "andrew",
        obligations: [
          {
            obligationId: "obl-a",
            expenseId: "exp-1",
            kind: "reimbursement",
            counterpartyMembershipId: "andrew",
          },
          {
            obligationId: "obl-b",
            expenseId: "exp-2",
            kind: "reimbursement",
            counterpartyMembershipId: "andrew",
          },
        ],
      },
    ]);
  });

  it("hides a relationship that still has an outstanding or pending obligation", () => {
    const settled = settledRelationships({
      viewerMembershipId: viewer,
      obligations: [
        {
          obligation_id: "open",
          debtor_membership_id: viewer,
          creditor_membership_id: "andrew",
          expense_id: "exp",
          obligation_kind: "reimbursement",
          official_outstanding_cents: 4500,
          pending_payment_cents: 0,
        },
        {
          obligation_id: "pending",
          debtor_membership_id: "sam",
          creditor_membership_id: viewer,
          expense_id: null,
          obligation_kind: "opening_balance",
          official_outstanding_cents: 0,
          pending_payment_cents: 1000,
        },
      ],
    });
    expect(settled).toEqual([]);
  });
});
