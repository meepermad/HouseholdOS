import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReceiptUploader } from "@/components/receipts/ReceiptUploader";
import { ReceiptReviewForm } from "@/components/receipts/ReceiptReviewForm";
import { CommentThread } from "@/components/comments/CommentThread";
import { ImportCsvPanel } from "@/components/import/ImportCsvPanel";

vi.mock("@/app/actions/receipts", () => ({
  uploadReceiptAction: vi.fn(async () => ({ ok: true })),
  updateReceiptReviewAction: vi.fn(async () => ({ ok: true })),
  confirmReceiptAsExpenseAction: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/app/actions/comments", () => ({
  addRecordCommentAction: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/app/actions/import", () => ({
  createImportBatchAction: vi.fn(async () => ({ ok: true })),
  confirmImportBatchAction: vi.fn(async () => ({ ok: true })),
}));

describe("receipt and import components", () => {
  it("shows OCR not configured messaging", () => {
    render(
      <ReceiptUploader
        householdId="hh"
        ocrConfigured={false}
        ocrMessage="Automatic extraction is not configured."
      />,
    );
    expect(screen.getByTestId("receipt-ocr-status")).toHaveTextContent(
      /not configured/i,
    );
  });

  it("renders review form with duplicate warning", () => {
    render(
      <ReceiptReviewForm
        householdId="hh"
        receiptId="r1"
        merchant="Store"
        purchaseDate="2026-07-01"
        declaredTotalCents={1350}
        duplicateOutcome="possible"
        status="needs_review"
        lineItems={[
          {
            sortIndex: 0,
            ocrText: "MILK",
            correctedName: "Milk",
            quantity: 1,
            unitPriceCents: 450,
            totalPriceCents: 450,
            classification: "shared_household",
            resourceDestination: "pantry_restock",
            reviewStatus: "pending",
            participantMembershipIds: [],
          },
        ]}
      />,
    );
    expect(screen.getByTestId("receipt-duplicate-warning")).toBeInTheDocument();
    expect(screen.getByTestId("receipt-review")).toBeInTheDocument();
  });

  it("renders comment thread", () => {
    render(
      <CommentThread
        householdId="hh"
        parentType="expense"
        parentId="e1"
        comments={[]}
      />,
    );
    expect(screen.getByTestId("comment-thread")).toBeInTheDocument();
  });

  it("renders import panel", () => {
    render(<ImportCsvPanel householdId="hh" />);
    expect(screen.getByTestId("import-csv-panel")).toBeInTheDocument();
  });
});
