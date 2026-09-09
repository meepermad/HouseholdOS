import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReceiptRepastePanel } from "@/components/receipts/ReceiptRepastePanel";
import { buildRepastePlan } from "@/lib/receipts/paste/repaste-plan";
import { parseHouseholdOsReceipt } from "@/lib/receipts/paste/parse";
import {
  PASTE_FIXTURE_WALMART_TRASH,
  PASTE_FIXTURE_WALMART_TRASH_CORRECTED,
} from "@/lib/receipts/paste/fixtures";

vi.mock("@/app/actions/receipts", () => ({
  previewRepasteReceiptAction: vi.fn(async (_prev: unknown, formData: FormData) => {
    const text = String(formData.get("originalText") ?? "");
    const parsed = parseHouseholdOsReceipt(text);
    const current = parseHouseholdOsReceipt(PASTE_FIXTURE_WALMART_TRASH);
    if (!parsed.ok || !parsed.receipt || !current.ok || !current.receipt) {
      return { ok: false, error: "Could not read that receipt." };
    }
    const plan = buildRepastePlan(
      {
        receiptId: "R1",
        status: "needs_review",
        merchant: current.receipt.merchant,
        purchaseDate: current.receipt.purchaseDate,
        totalCents: current.receipt.totalCents,
        subtotalCents: current.receipt.subtotalCents,
        taxCents: current.receipt.taxCents,
        tipCents: current.receipt.tipCents,
        feeCents: current.receipt.feeCents,
        discountCents: current.receipt.discountCents,
        lines: current.receipt.items.map((item, index) => ({
          id: `line-${index + 1}`,
          sortIndex: index,
          displayDescription: item.description,
          sourceText: item.raw,
          totalCents: item.totalCents,
          quantity: item.quantity,
        })),
      },
      parsed.receipt,
    );
    return { ok: true, previewJson: JSON.stringify(plan) };
  }),
  applyRepasteReceiptAction: vi.fn(async () => ({ ok: true, data: { receiptId: "R1" } })),
}));

describe("ReceiptRepastePanel", () => {
  it("hides re-paste after finalization and shows Correct receipt", () => {
    render(
      <ReceiptRepastePanel
        householdId="hh"
        receiptId="R1"
        status="confirmed"
        expenseId="E1"
        originalTranscription={PASTE_FIXTURE_WALMART_TRASH}
        transcriptionCorrected
      />,
    );
    expect(screen.queryByTestId("receipt-repaste")).not.toBeInTheDocument();
    expect(screen.getByTestId("receipt-correct-receipt")).toHaveTextContent("Correct receipt");
  });

  it("opens the correction editor from More and keeps the current receipt on cancel", async () => {
    const user = userEvent.setup();
    const apply = await import("@/app/actions/receipts");
    render(
      <ReceiptRepastePanel
        householdId="hh"
        receiptId="R1"
        status="needs_review"
        originalTranscription={PASTE_FIXTURE_WALMART_TRASH}
      />,
    );
    await user.click(screen.getByTestId("receipt-more-menu"));
    await user.click(screen.getByTestId("receipt-repaste"));
    expect(screen.getByTestId("receipt-repaste-editor")).toHaveTextContent(
      "Correct receipt transcription",
    );
    await user.click(screen.getByTestId("receipt-repaste-cancel"));
    expect(screen.queryByTestId("receipt-repaste-editor")).not.toBeInTheDocument();
    expect(apply.applyRepasteReceiptAction).not.toHaveBeenCalled();
  });

  it("shows a human-readable description-only diff before apply", async () => {
    const user = userEvent.setup();
    render(
      <ReceiptRepastePanel
        householdId="hh"
        receiptId="R1"
        status="needs_review"
        originalTranscription={PASTE_FIXTURE_WALMART_TRASH}
      />,
    );
    await user.click(screen.getByTestId("receipt-more-menu"));
    await user.click(screen.getByTestId("receipt-repaste"));
    fireEvent.change(screen.getByTestId("receipt-repaste-textarea"), {
      target: { value: PASTE_FIXTURE_WALMART_TRASH_CORRECTED },
    });
    await user.click(screen.getByTestId("receipt-read-corrected"));
    expect(await screen.findByTestId("receipt-repaste-diff")).toHaveTextContent(
      "Here's what changed",
    );
    expect(screen.getByTestId("receipt-repaste-diff")).toHaveTextContent("Item name changed");
    expect(screen.getByText("Only item names changed. Existing assignments can be kept.")).toBeInTheDocument();
    expect(screen.getByTestId("receipt-use-corrected")).toBeEnabled();
  });
});
