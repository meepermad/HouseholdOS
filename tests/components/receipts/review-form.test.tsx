import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReceiptReviewForm } from "@/components/receipts/ReceiptReviewForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/app/actions/receipts", () => ({
  updateReceiptReviewAction: vi.fn(async () => ({ ok: true })),
  confirmReceiptAsExpenseAction: vi.fn(async () => ({ ok: true })),
  startReceiptClaimingAction: vi.fn(async () => ({ ok: true })),
  setReceiptSplitWorkflowAction: vi.fn(async () => ({ ok: true })),
  claimReceiptLinesAction: vi.fn(async () => ({ ok: true })),
  unclaimReceiptLineAction: vi.fn(async () => ({ ok: true })),
  markReceiptLineSharedAction: vi.fn(async () => ({ ok: true })),
  assignReceiptLineAction: vi.fn(async () => ({ ok: true })),
  applyRemainingReceiptLinesAction: vi.fn(async () => ({ ok: true })),
  finishReceiptClaimingAction: vi.fn(async () => ({ ok: true })),
  finalizeReceiptClaimsAction: vi.fn(async () => ({ ok: true })),
  remindReceiptClaimingAction: vi.fn(async () => ({ ok: true })),
}));

const members = [
  { id: "m1", label: "Atem" },
  { id: "m2", label: "Andrew" },
  { id: "m3", label: "Henry" },
  { id: "m4", label: "Michael" },
];

const lines = [
  {
    id: "l1",
    sortIndex: 0,
    ocrText: "SHAMPOO",
    correctedName: "Shampoo",
    quantity: 1,
    unitPriceCents: 849,
    totalPriceCents: 849,
    classification: "needs_review" as const,
    resourceDestination: "none" as const,
    reviewStatus: "pending",
    participantMembershipIds: [],
  },
  {
    id: "l2",
    sortIndex: 1,
    ocrText: "SODA",
    correctedName: "Soda",
    quantity: 1,
    unitPriceCents: 749,
    totalPriceCents: 749,
    classification: "needs_review" as const,
    resourceDestination: "none" as const,
    reviewStatus: "pending",
    participantMembershipIds: [],
  },
];

describe("ReceiptReviewForm simple flow", () => {
  it("asks how to split after Looks right, without cents or allocation jargon", async () => {
    const user = userEvent.setup();
    render(
      <ReceiptReviewForm
        householdId="hh"
        receiptId="r1"
        merchant="Target"
        purchaseDate="2026-09-04"
        declaredTotalCents={9240}
        status="needs_review"
        payerMembershipId="m1"
        currentMembershipId="m1"
        members={members}
        lineItems={lines}
      />,
    );

    expect(screen.getByText("Target")).toBeInTheDocument();
    expect(screen.getByText("$92.40")).toBeInTheDocument();
    expect(screen.queryByText(/cents/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/allocation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pantry/i)).not.toBeInTheDocument();

    await user.click(screen.getByTestId("receipt-looks-right"));
    expect(screen.getByTestId("split-everything")).toBeInTheDocument();
    expect(screen.getByTestId("assign-items")).toBeInTheDocument();
    expect(screen.getByTestId("let-everyone-claim")).toBeInTheDocument();
  });

  it("lets a roommate select items and claim them in one action", async () => {
    const user = userEvent.setup();
    render(
      <ReceiptReviewForm
        householdId="hh"
        receiptId="r1"
        merchant="Target"
        purchaseDate="2026-09-04"
        declaredTotalCents={9240}
        status="claiming"
        splitWorkflow="claiming"
        payerMembershipId="m1"
        currentMembershipId="m2"
        members={members}
        lineItems={lines}
        startInClaimMode
      />,
    );

    expect(screen.getByText("Select what is yours")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Select Shampoo"));
    await user.click(screen.getByLabelText("Select Soda"));
    expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
    expect(screen.getByTestId("claim-mine")).toBeEnabled();
    await user.click(screen.getByTestId("claim-mine"));
  });

  it("does not force line review for split-everything", async () => {
    const user = userEvent.setup();
    render(
      <ReceiptReviewForm
        householdId="hh"
        receiptId="r1"
        merchant="Target"
        purchaseDate="2026-09-04"
        declaredTotalCents={9240}
        status="needs_review"
        payerMembershipId="m1"
        currentMembershipId="m1"
        members={members}
        lineItems={lines}
      />,
    );
    await user.click(screen.getByTestId("receipt-looks-right"));
    await user.click(screen.getByTestId("split-everything"));
    expect(screen.getByTestId("receipt-equal-split")).toBeInTheDocument();
    expect(screen.queryByTestId("receipt-line-items")).not.toBeInTheDocument();
    expect(screen.getByTestId("receipt-confirm-expense")).toBeEnabled();
  });
});
