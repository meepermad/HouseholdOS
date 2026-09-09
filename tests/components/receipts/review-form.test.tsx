import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assignReceiptLineAction,
  claimReceiptLinesAction,
  markReceiptLineSharedAction,
  updateReceiptReviewAction,
} from "@/app/actions/receipts";
import { ReceiptReviewForm } from "@/components/receipts/ReceiptReviewForm";

const routerMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
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
  previewRepasteReceiptAction: vi.fn(async () => ({ ok: true, previewJson: "{}" })),
  applyRepasteReceiptAction: vi.fn(async () => ({ ok: true })),
  acknowledgeReceiptCorrectionAction: vi.fn(async () => ({ ok: true })),
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

const assignLines = [
  ...lines,
  {
    id: "l3",
    sortIndex: 2,
    ocrText: "BREAD",
    correctedName: "Bread",
    quantity: 1,
    unitPriceCents: 399,
    totalPriceCents: 399,
    classification: "needs_review" as const,
    resourceDestination: "none" as const,
    reviewStatus: "pending",
    participantMembershipIds: [],
  },
  {
    id: "l4",
    sortIndex: 3,
    ocrText: "BAG",
    correctedName: "Bag fee",
    quantity: 1,
    unitPriceCents: 10,
    totalPriceCents: 10,
    classification: "needs_review" as const,
    resourceDestination: "none" as const,
    reviewStatus: "pending",
    participantMembershipIds: [],
  },
];

function renderAssignForm() {
  return render(
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
      lineItems={assignLines}
    />,
  );
}

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

  it("lets the payer share equally among some people", async () => {
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
    await user.click(screen.getByLabelText("Henry"));
    await user.click(screen.getByLabelText("Michael"));
    expect(screen.getByTestId("receipt-confirm-expense")).toBeEnabled();
    await user.click(screen.getByTestId("receipt-confirm-expense"));
    expect(screen.queryByText(/invalid input/i)).not.toBeInTheDocument();
  });

  it("asks for at least one person when nobody is selected to share equally", async () => {
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
    for (const name of ["Atem", "Andrew", "Henry", "Michael"]) {
      await user.click(screen.getByLabelText(name));
    }
    await user.click(screen.getByTestId("receipt-confirm-expense"));
    expect(
      screen.getByText("Choose at least one person to share this with."),
    ).toBeInTheDocument();
  });

  it("explains a failed receipt with recovery actions, not worker codes", () => {
    render(
      <ReceiptReviewForm
        householdId="hh"
        receiptId="r1"
        merchant=""
        purchaseDate="2026-09-04"
        declaredTotalCents={0}
        status="failed"
        ocrOutcome="timeout"
        lastError="OCR_WORKER_TIMEOUT"
        payerMembershipId="m1"
        currentMembershipId="m1"
        members={members}
        lineItems={[]}
      />,
    );
    const banner = screen.getByTestId("receipt-manual-fallback");
    expect(banner).toHaveTextContent(/timed out|could not read/i);
    expect(banner).toHaveTextContent(/enter the merchant/i);
    expect(banner).not.toHaveTextContent("OCR_WORKER_TIMEOUT");
    expect(screen.getByTestId("receipt-enter-manually")).toBeInTheDocument();
    expect(screen.getByTestId("receipt-try-again")).toHaveAttribute(
      "href",
      "/app/hh/money/receipts/new",
    );
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

  it("shows Re-paste under Advanced on a confirmed pasted receipt", async () => {
    const user = userEvent.setup();
    render(
      <ReceiptReviewForm
        householdId="hh"
        receiptId="r1"
        merchant="Target"
        purchaseDate="2026-09-04"
        declaredTotalCents={9240}
        status="confirmed"
        splitWorkflow="equal_all"
        payerMembershipId="m1"
        currentMembershipId="m1"
        members={members}
        lineItems={lines}
        intakeSource="paste"
        originalTranscription="HOUSEHOLDOS RECEIPT\nMerchant: Target\nTotal: 92.40\nITEMS\nShampoo | 8.49 | 1\nEND"
        expenseId="e1"
      />,
    );

    expect(screen.queryByText("Advanced split options")).not.toBeInTheDocument();
    expect(screen.getByTestId("receipt-correct-finalized")).toHaveTextContent(
      "open Advanced",
    );
    expect(screen.queryByRole("button", { name: /re-paste receipt/i })).not.toBeInTheDocument();

    const advanced = screen.getByTestId("receipt-advanced");
    expect(advanced).toHaveTextContent("Advanced");
    expect(advanced).toHaveTextContent("Re-paste a corrected receipt");
    await user.click(screen.getByRole("button", { name: /advanced/i }));
    expect(screen.getByRole("button", { name: /re-paste receipt/i })).toBeInTheDocument();
  });

  it("shows Re-paste under Advanced on a confirmed camera receipt", async () => {
    const user = userEvent.setup();
    render(
      <ReceiptReviewForm
        householdId="hh"
        receiptId="r1"
        merchant="Target"
        purchaseDate="2026-09-04"
        declaredTotalCents={9240}
        status="confirmed"
        splitWorkflow="assign_items"
        payerMembershipId="m1"
        currentMembershipId="m1"
        members={members}
        lineItems={lines}
        intakeSource="camera"
        originalTranscription="MILK 4.29"
        expenseId="e1"
      />,
    );

    expect(screen.queryByText("Advanced split options")).not.toBeInTheDocument();
    expect(screen.getByTestId("receipt-correct-finalized")).toHaveTextContent("Camera");
    await user.click(screen.getByRole("button", { name: /advanced/i }));
    expect(screen.getByRole("button", { name: /re-paste receipt/i })).toBeInTheDocument();
    expect(screen.getByTestId("receipt-repaste-panel")).toHaveTextContent(
      "This starts a correction",
    );
  });
});

describe("ReceiptReviewForm assign items", () => {
  beforeEach(() => {
    routerMocks.refresh.mockClear();
    routerMocks.push.mockClear();
    vi.mocked(claimReceiptLinesAction).mockReset();
    vi.mocked(claimReceiptLinesAction).mockResolvedValue({ ok: true });
    vi.mocked(markReceiptLineSharedAction).mockReset();
    vi.mocked(markReceiptLineSharedAction).mockResolvedValue({ ok: true });
    vi.mocked(assignReceiptLineAction).mockReset();
    vi.mocked(assignReceiptLineAction).mockResolvedValue({ ok: true });
  });

  async function openAssignment(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByTestId("receipt-looks-right"));
    expect(screen.getByTestId("assign-items")).toHaveAttribute("type", "button");
    await user.click(screen.getByTestId("assign-items"));
    expect(screen.getByTestId("receipt-assign-panel")).toBeInTheDocument();
    const headerFd = vi.mocked(updateReceiptReviewAction).mock.calls.at(-1)?.[1] as
      | FormData
      | undefined;
    expect(headerFd?.get("lineItemsJson")).toBe("null");
  }

  it("keeps assignment open while assigning multiple items, then closes on Done", async () => {
    const user = userEvent.setup();
    renderAssignForm();
    await openAssignment(user);
    expect(routerMocks.refresh).not.toHaveBeenCalled();
    expect(screen.getByTestId("receipt-review").querySelector("form")).toBeNull();

    await user.click(screen.getByTestId("assign-line-l1"));
    expect(screen.getByTestId("receipt-assign-row")).toBeInTheDocument();
    expect(screen.getByTestId("assign-mine")).toHaveAttribute("type", "button");
    expect(screen.getByTestId("assign-shared")).toHaveAttribute("type", "button");
    expect(screen.getByTestId("assign-exclude")).toHaveAttribute("type", "button");
    expect(screen.getByTestId("receipt-assign-done")).toHaveAttribute("type", "button");
    expect(screen.getByTestId("receipt-assign-cancel")).toHaveAttribute("type", "button");

    await user.click(screen.getByTestId("assign-mine"));
    await waitFor(() => {
      expect(screen.getByTestId("assign-line-status-l1")).toHaveTextContent("Yours");
    });
    expect(screen.getByTestId("receipt-assign-panel")).toBeInTheDocument();
    expect(screen.getByTestId("receipt-assign-row")).toBeInTheDocument();
    expect(routerMocks.refresh).not.toHaveBeenCalled();
    expect(routerMocks.push).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("assign-line-l2"));
    await user.click(screen.getByTestId("assign-shared"));
    await waitFor(() => {
      expect(screen.getByTestId("assign-line-status-l2")).toHaveTextContent(
        "Shared with everyone",
      );
    });
    expect(screen.getByTestId("receipt-assign-panel")).toBeInTheDocument();

    await user.click(screen.getByTestId("assign-line-l3"));
    await user.selectOptions(screen.getByTestId("assign-someone-else"), "m2");
    await waitFor(() => {
      expect(screen.getByTestId("assign-line-status-l3")).toHaveTextContent("Andrew's");
    });
    expect(screen.getByTestId("receipt-assign-panel")).toBeInTheDocument();
    expect(screen.getByTestId("assign-someone-else")).toBeInTheDocument();

    await user.click(screen.getByTestId("assign-line-l4"));
    await user.click(screen.getByTestId("assign-exclude"));
    await waitFor(() => {
      expect(screen.getByTestId("assign-line-status-l4")).toHaveTextContent(
        "Not reimbursed",
      );
    });
    expect(screen.getByTestId("receipt-assign-panel")).toBeInTheDocument();

    await user.click(screen.getByTestId("receipt-assign-done"));
    expect(screen.queryByTestId("receipt-assign-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("receipt-final-review")).toBeInTheDocument();
    expect(claimReceiptLinesAction).toHaveBeenCalled();
    expect(markReceiptLineSharedAction).toHaveBeenCalled();
    expect(assignReceiptLineAction).toHaveBeenCalled();
  });

  it("closes assignment on Cancel and returns to split choice", async () => {
    const user = userEvent.setup();
    renderAssignForm();
    await openAssignment(user);
    await user.click(screen.getByTestId("receipt-assign-cancel"));
    expect(screen.queryByTestId("receipt-assign-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("receipt-split-choice")).toBeInTheDocument();
  });

  it("does not close on Escape or outside click", async () => {
    const user = userEvent.setup();
    renderAssignForm();
    await openAssignment(user);
    await user.click(screen.getByTestId("assign-line-l1"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByTestId("receipt-assign-panel")).toBeInTheDocument();
    expect(screen.getByTestId("receipt-assign-row")).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.getByTestId("receipt-assign-panel")).toBeInTheDocument();
    expect(screen.getByTestId("receipt-assign-row")).toBeInTheDocument();
  });

  it("keeps assignment open when a line mutation fails", async () => {
    const user = userEvent.setup();
    vi.mocked(claimReceiptLinesAction).mockResolvedValueOnce({
      ok: false,
      error: "Could not claim.",
    });
    renderAssignForm();
    await openAssignment(user);
    await user.click(screen.getByTestId("assign-line-l1"));
    await user.click(screen.getByTestId("assign-mine"));
    await waitFor(() => {
      expect(screen.getByText("Could not claim.")).toBeInTheDocument();
    });
    expect(screen.getByTestId("receipt-assign-panel")).toBeInTheDocument();
    expect(screen.getByTestId("receipt-assign-row")).toBeInTheDocument();
    expect(screen.getByTestId("assign-line-status-l1")).not.toHaveTextContent("Yours");
  });

  it("keeps assignment open after a receipt prop refresh", async () => {
    const user = userEvent.setup();
    const { rerender } = renderAssignForm();
    await openAssignment(user);
    await user.click(screen.getByTestId("assign-line-l1"));
    await user.click(screen.getByTestId("assign-mine"));
    await waitFor(() => {
      expect(screen.getByTestId("assign-line-status-l1")).toHaveTextContent("Yours");
    });
    rerender(
      <ReceiptReviewForm
        householdId="hh"
        receiptId="r1"
        merchant="Target"
        purchaseDate="2026-09-04"
        declaredTotalCents={9240}
        status="needs_review"
        splitWorkflow="assign_items"
        payerMembershipId="m1"
        currentMembershipId="m1"
        members={members}
        lineItems={assignLines.map((line) =>
          line.id === "l1"
            ? {
                ...line,
                classification: "personal_purchaser" as const,
              }
            : line,
        )}
        claims={[
          {
            lineItemId: "l1",
            membershipId: "m1",
            quantity: 1,
            kind: "mine",
          },
        ]}
      />,
    );
    expect(screen.getByTestId("receipt-assign-panel")).toBeInTheDocument();
    expect(screen.getByTestId("receipt-assign-row")).toBeInTheDocument();
    expect(screen.getByTestId("assign-line-status-l1")).toHaveTextContent("Yours");
  });

  it("ignores a duplicate Mine click while the first mutation is pending", async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(claimReceiptLinesAction).mockImplementationOnce(async () => {
      await gate;
      return { ok: true };
    });
    renderAssignForm();
    await openAssignment(user);
    await user.click(screen.getByTestId("assign-line-l1"));
    await user.click(screen.getByTestId("assign-mine"));
    expect(screen.getByTestId("assign-mine")).toBeDisabled();
    await user.click(screen.getByTestId("assign-mine"));
    release();
    await waitFor(() => {
      expect(screen.getByTestId("assign-line-status-l1")).toHaveTextContent("Yours");
    });
    expect(claimReceiptLinesAction).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("receipt-assign-panel")).toBeInTheDocument();
  });

  it.each([390, 430])(
    "keeps assignment open after Mine at %ipx width",
    async (width) => {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: width,
      });
      const user = userEvent.setup();
      renderAssignForm();
      await openAssignment(user);
      await user.click(screen.getByTestId("assign-line-l1"));
      await user.click(screen.getByTestId("assign-mine"));
      await waitFor(() => {
        expect(screen.getByTestId("assign-line-status-l1")).toHaveTextContent("Yours");
      });
      expect(screen.getByTestId("receipt-assign-panel")).toBeInTheDocument();
      expect(screen.getByTestId("receipt-assign-done")).toBeInTheDocument();
    },
  );
});
