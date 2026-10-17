import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HouseholdSettlementPlan } from "@/components/payments/HouseholdSettlementPlan";
import type { HouseholdSettlementPlan as Plan } from "@/lib/payments/household-plan";

const ALEX = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const JORDAN = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const SAM = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const TAYLOR = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const HOUSE = "hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh";

const labels = {
  [ALEX]: "Alex",
  [JORDAN]: "Jordan",
  [SAM]: "Sam",
  [TAYLOR]: "Taylor",
};

const plan: Plan = {
  offsets: [
    {
      amountCents: 300,
      currency: "USD",
      membershipIds: [JORDAN, TAYLOR],
      legs: [
        {
          obligationId: "33333333-3333-3333-3333-333333333333",
          debtorMembershipId: TAYLOR,
          creditorMembershipId: JORDAN,
          amountCents: 300,
        },
        {
          obligationId: "44444444-4444-4444-4444-444444444444",
          debtorMembershipId: JORDAN,
          creditorMembershipId: TAYLOR,
          amountCents: 300,
        },
      ],
    },
  ],
  payments: [
    {
      payerMembershipId: SAM,
      recipientMembershipId: JORDAN,
      amountCents: 3500,
      currency: "USD",
      legs: [
        {
          obligationId: "22222222-2222-2222-2222-222222222222",
          debtorMembershipId: SAM,
          creditorMembershipId: ALEX,
          amountCents: 3500,
        },
        {
          obligationId: "11111111-1111-1111-1111-111111111111",
          debtorMembershipId: ALEX,
          creditorMembershipId: JORDAN,
          amountCents: 3500,
        },
      ],
    },
    {
      payerMembershipId: ALEX,
      recipientMembershipId: JORDAN,
      amountCents: 500,
      currency: "USD",
      legs: [
        {
          obligationId: "11111111-1111-1111-1111-111111111111",
          debtorMembershipId: ALEX,
          creditorMembershipId: JORDAN,
          amountCents: 500,
        },
      ],
    },
    {
      payerMembershipId: TAYLOR,
      recipientMembershipId: JORDAN,
      amountCents: 500,
      currency: "USD",
      legs: [
        {
          obligationId: "33333333-3333-3333-3333-333333333333",
          debtorMembershipId: TAYLOR,
          creditorMembershipId: JORDAN,
          amountCents: 500,
        },
      ],
    },
  ],
};

describe("HouseholdSettlementPlan", () => {
  it("shows the whole four-person plan before anyone records a payment", () => {
    render(
      <HouseholdSettlementPlan
        householdId={HOUSE}
        plan={plan}
        openPayments={[]}
        memberLabels={labels}
        currentMembershipId={SAM}
        recordingReady
      />,
    );
    expect(screen.getByText("Sam pays Jordan $35.00")).toBeInTheDocument();
    expect(screen.getByText("Alex pays Jordan $5.00")).toBeInTheDocument();
    expect(screen.getByText("Taylor pays Jordan $5.00")).toBeInTheDocument();
    expect(screen.getByText(/already cover \$3\.00 each way/)).toBeInTheDocument();
    expect(screen.getByTestId("clear-household-offsets")).toBeInTheDocument();
    expect(screen.queryByTestId("record-household-payment")).toBeNull();
  });

  it("lets the payer record the only remaining payment", () => {
    render(
      <HouseholdSettlementPlan
        householdId={HOUSE}
        plan={{
          offsets: [],
          payments: [plan.payments[1]!],
        }}
        openPayments={[]}
        memberLabels={labels}
        currentMembershipId={ALEX}
        recordingReady
      />,
    );
    expect(screen.getByText("Alex pays Jordan $5.00")).toBeInTheDocument();
    expect(screen.getByTestId("record-household-payment")).toHaveTextContent(
      "Record payment to Jordan",
    );
  });

  it("asks the recipient to confirm a recorded payment", () => {
    render(
      <HouseholdSettlementPlan
        householdId={HOUSE}
        plan={{ offsets: [], payments: [] }}
        openPayments={[
          {
            id: "55555555-5555-5555-5555-555555555555",
            payerMembershipId: SAM,
            recipientMembershipId: JORDAN,
            amountCents: 3500,
            currency: "USD",
            status: "submitted",
          },
        ]}
        memberLabels={labels}
        currentMembershipId={JORDAN}
        recordingReady
      />,
    );
    expect(screen.getByText(/Sam paid Jordan \$35\.00/)).toBeInTheDocument();
    expect(screen.getByTestId("confirm-household-payment")).toBeInTheDocument();
  });
});
