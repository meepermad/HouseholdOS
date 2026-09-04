export const RECEIPT_BUCKET = "expense-receipts";
/** Server hard cap after client compression. Large phone photos are resized first. */
export const RECEIPT_MAX_BYTES = 20 * 1024 * 1024; // 20 MiB
export const RECEIPT_MAX_PDF_PAGES = 10;
export const RECEIPT_MAX_IMAGE_PIXELS = 40_000_000;
/** Target longest edge for the stored/OCR working copy. */
export const RECEIPT_UPLOAD_MAX_DIMENSION = 2400;
/** Target JPEG quality for the stored working copy. */
export const RECEIPT_UPLOAD_JPEG_QUALITY = 0.82;
/** Soft cap for the bytes we actually upload after local compression. */
export const RECEIPT_UPLOAD_TARGET_BYTES = 3 * 1024 * 1024;
export const RECEIPT_OCR_TIMEOUT_MS = 45_000;

export const RECEIPT_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const RECEIPT_HEIC_MIME_TYPES = [
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
] as const;

/**
 * Library picker accept list. Omit HEIC/HEIF so iOS Photos converts to JPEG
 * instead of handing the web app a raw HEIC that often OOMs Safari.
 */
export const RECEIPT_LIBRARY_ACCEPT =
  "image/jpeg,image/png,image/webp,application/pdf";
/** Camera capture: JPEG/PNG only. */
export const RECEIPT_CAMERA_ACCEPT = "image/jpeg,image/png";
/** Skip in-browser HEIC decode above this size to avoid iPhone Safari OOM. */
export const RECEIPT_HEIC_DECODE_MAX_BYTES = 8 * 1024 * 1024;

export type ReceiptMimeType = (typeof RECEIPT_ALLOWED_MIME_TYPES)[number];

export type ReceiptStatus =
  | "uploaded"
  | "extracting"
  | "needs_review"
  | "claiming"
  | "ready_for_review"
  | "confirmed"
  | "rejected"
  | "failed";

export type ReceiptSplitWorkflow = "equal_all" | "assign_items" | "claiming";

export type ReceiptOcrOutcome =
  | "pending"
  | "succeeded"
  | "failed"
  | "manual"
  | "timeout";

export type LineOwnershipKind =
  | "unclaimed"
  | "mine"
  | "someone_else"
  | "shared"
  | "household"
  | "excluded"
  | "quantity";

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
