export const RECEIPT_BUCKET = "expense-receipts";
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024; // 10 MiB
export const RECEIPT_MAX_PDF_PAGES = 10;
export const RECEIPT_MAX_IMAGE_PIXELS = 40_000_000;

export const RECEIPT_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export type ReceiptMimeType = (typeof RECEIPT_ALLOWED_MIME_TYPES)[number];

export type ReceiptStatus =
  | "uploaded"
  | "extracting"
  | "needs_review"
  | "confirmed"
  | "rejected"
  | "failed";

export type LineItemClassification =
  | "shared_household"
  | "personal_purchaser"
  | "personal_other"
  | "shared_selected"
  | "excluded"
  | "needs_review";

export type ResourceDestination =
  | "none"
  | "pantry_add"
  | "pantry_restock"
  | "supply_add"
  | "supply_restock"
  | "inventory_add"
  | "shopping_complete"
  | "do_not_track";

export type DuplicateOutcome =
  | "none"
  | "exact"
  | "possible"
  | "existing_expense";

export type ExtractedLineItem = {
  ocrText: string;
  name: string;
  quantity: number | null;
  unitPriceCents: number | null;
  totalPriceCents: number | null;
  confidence: number | null;
};

export type ExtractedReceipt = {
  merchant: string | null;
  purchaseDate: string | null;
  subtotalCents: number | null;
  taxCents: number | null;
  tipCents: number | null;
  totalCents: number | null;
  currency: string;
  paymentMethodSummary: string | null;
  lineItems: ExtractedLineItem[];
  confidence: number | null;
  contentHash: string;
};
