import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
import { ReceiptUploader } from "@/components/receipts/ReceiptUploader";
import { ReceiptReviewForm } from "@/components/receipts/ReceiptReviewForm";
import { CommentThread } from "@/components/comments/CommentThread";
import { ImportCsvPanel } from "@/components/import/ImportCsvPanel";
import { normalizeReceiptUpload } from "@/lib/receipts/client/normalize-upload";
import { uploadReceiptAction } from "@/app/actions/receipts";
import { RECEIPT_LIBRARY_ACCEPT } from "@/lib/receipts/types";

vi.mock("@/app/actions/receipts", () => ({
  uploadReceiptAction: vi.fn(async () => ({ ok: true })),
  registerPastedReceiptAction: vi.fn(async () => ({ ok: true })),
  updateReceiptReviewAction: vi.fn(async () => ({ ok: true })),
  confirmReceiptAsExpenseAction: vi.fn(async () => ({ ok: true })),
  submitLocalReceiptExtractionAction: vi.fn(async () => ({ ok: true })),
  upsertReceiptAliasAction: vi.fn(async () => ({ ok: true })),
  deleteReceiptAliasAction: vi.fn(async () => ({ ok: true })),
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
  markReceiptOcrOutcomeAction: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/receipts/client/tesseract-session", () => ({
  cancelLocalOcr: vi.fn(),
  terminateLocalOcrWorker: vi.fn(async () => undefined),
  runLocalOcrOnImages: vi.fn(),
}));

vi.mock("@/lib/receipts/client/offline-draft", () => ({
  listOfflineReceiptDrafts: vi.fn(async () => []),
  saveOfflineReceiptDraft: vi.fn(async () => undefined),
  discardOfflineReceiptDraft: vi.fn(async () => undefined),
  getOfflineReceiptDraft: vi.fn(async () => null),
}));

vi.mock("@/lib/receipts/client/normalize-upload", () => ({
  normalizeReceiptUpload: vi.fn(),
}));

vi.mock("@/app/actions/comments", () => ({
  addRecordCommentAction: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/app/actions/import", () => ({
  createImportBatchAction: vi.fn(async () => ({ ok: true })),
  confirmImportBatchAction: vi.fn(async () => ({ ok: true })),
}));

describe("receipt and import components", () => {
  it("shows local OCR privacy messaging", () => {
    render(
      <ReceiptUploader
        householdId="hh"
        ocrConfigured={true}
        ocrMessage="Processed privately on this device."
        privacyLabel="Processed privately on this device"
      />,
    );
    expect(screen.getByTestId("receipt-ocr-status")).toHaveTextContent(
      /Processed privately on this device/i,
    );
    expect(screen.getByTestId("receipt-provider-disclosure")).toBeInTheDocument();
  });

  it("shows OCR not configured messaging", () => {
    render(
      <ReceiptUploader
        householdId="hh"
        ocrConfigured={false}
        ocrMessage="Automatic extraction is not configured. Enter the receipt manually."
        privacyLabel="Automatic extraction is not configured"
      />,
    );
    expect(screen.getByTestId("receipt-ocr-status")).toHaveTextContent(
      /not configured/i,
    );
  });

  it("renders review form with duplicate warning and simple header", () => {
    render(
      <ReceiptReviewForm
        householdId="hh"
        receiptId="r1"
        merchant="Store"
        purchaseDate="2026-07-01"
        declaredTotalCents={1350}
        duplicateOutcome="possible"
        status="needs_review"
        payerMembershipId="m1"
        currentMembershipId="m1"
        members={[
          { id: "m1", label: "Atem" },
          { id: "m2", label: "Andrew" },
        ]}
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
    expect(screen.getByTestId("receipt-looks-right")).toBeInTheDocument();
    expect(screen.getByText("$13.50")).toBeInTheDocument();
    expect(screen.queryByText(/cents/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/allocation/i)).not.toBeInTheDocument();
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

  it("does not ask iOS for raw HEIC in the file picker", () => {
    render(
      <ReceiptUploader
        householdId="11111111-1111-4111-8111-111111111111"
        ocrConfigured
        ocrMessage="ok"
        privacyLabel="ok"
      />,
    );
    const input = screen.getByTestId("receipt-file-input");
    expect(input).toHaveAttribute("accept", RECEIPT_LIBRARY_ACCEPT);
    expect(input.getAttribute("accept")).not.toMatch(/heic|heif/i);
  });

  it("recovers from a HEIC conversion failure without crashing", async () => {
    vi.mocked(normalizeReceiptUpload).mockRejectedValueOnce(
      new Error(
        "This iPhone photo format (HEIC) could not be converted here. Take a screenshot, or in Camera settings choose Most Compatible, then try again.",
      ),
    );
    render(
      <ReceiptUploader
        householdId="11111111-1111-4111-8111-111111111111"
        ocrConfigured
        ocrMessage="ok"
        privacyLabel="ok"
      />,
    );
    const file = new File([new Uint8Array([1, 2, 3])], "IMG.HEIC", {
      type: "image/heic",
    });
    fireEvent.change(screen.getByTestId("receipt-file-input"), {
      target: { files: [file] },
    });
    expect(await screen.findByTestId("receipt-capture-error")).toHaveTextContent(
      /HEIC|iPhone/i,
    );
    expect(screen.getByTestId("receipt-enter-manually")).toHaveAttribute(
      "href",
      "/app/11111111-1111-4111-8111-111111111111/money/expenses/new",
    );
    expect(screen.getByTestId("receipt-try-jpeg")).toBeInTheDocument();
    expect(screen.queryByTestId("household-error-boundary")).not.toBeInTheDocument();
  });

  it("offers Sign in again back to Add receipt when the session expired", async () => {
    vi.mocked(normalizeReceiptUpload).mockResolvedValueOnce({
      file: new File([new Uint8Array([0xff, 0xd8, 0xff])], "r.jpg", {
        type: "image/jpeg",
      }),
      convertedFromHeic: false,
      resized: false,
      originalBytes: 3,
      outputBytes: 3,
      width: 10,
      height: 10,
    });
    vi.mocked(uploadReceiptAction).mockResolvedValueOnce({
      ok: false,
      error: "Your session expired. Sign in again, then you can add this receipt.",
    });
    render(
      <ReceiptUploader
        householdId="11111111-1111-4111-8111-111111111111"
        ocrConfigured
        ocrMessage="ok"
        privacyLabel="ok"
      />,
    );
    fireEvent.change(screen.getByTestId("receipt-file-input"), {
      target: {
        files: [
          new File([new Uint8Array([0xff, 0xd8, 0xff])], "r.jpg", {
            type: "image/jpeg",
          }),
        ],
      },
    });
    expect(await screen.findByTestId("receipt-sign-in-again")).toHaveAttribute(
      "href",
      expect.stringContaining("/login?next="),
    );
    expect(screen.getByTestId("receipt-sign-in-again").getAttribute("href")).toMatch(
      /money%2Freceipts%2Fnew/,
    );
  });
});
