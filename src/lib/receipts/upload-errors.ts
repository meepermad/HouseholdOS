/**
 * User-facing receipt upload errors. Never leak storage/RPC messages.
 */

export type ReceiptUploadErrorCode =
  | "unsupported_format"
  | "unsupported_heic"
  | "image_too_large"
  | "could_not_read"
  | "could_not_upload"
  | "ocr_failed"
  | "connection_lost"
  | "session_expired"
  | "manual_fallback"
  | "unknown";

export type ReceiptUploadStage =
  | "file_selected"
  | "client_validation"
  | "preprocessing"
  | "ocr_init"
  | "ocr_processing"
  | "storage_upload"
  | "registration"
  | "extraction"
  | "redirect"
  | "review_load";

const MESSAGES: Record<ReceiptUploadErrorCode, string> = {
  unsupported_format: "This file type is not supported. Use a JPEG, PNG, WebP, or PDF.",
  unsupported_heic:
    "This iPhone photo format (HEIC) could not be converted here. Take a screenshot, or in Camera settings choose Most Compatible, then try again.",
  image_too_large:
    "This photo is too large to upload. HouseholdOS will try to shrink it — if that still fails, take a closer photo of just the receipt.",
  could_not_read: "Could not read this image. Try another photo or enter the receipt manually.",
  could_not_upload: "Could not upload securely. Check your connection and try again.",
  ocr_failed: "Receipt saved, but text recognition failed. You can enter the details manually.",
  connection_lost: "Connection lost. Your receipt draft is saved on this device — retry when you are back online.",
  session_expired:
    "Your session expired. Sign in again, then you can add this receipt.",
  manual_fallback: "Receipt uploaded. Enter the details manually.",
  unknown: "Something went wrong while handling this receipt. Try again, or enter it manually.",
};

export function receiptUploadUserMessage(code: ReceiptUploadErrorCode): string {
  return MESSAGES[code];
}

export function mapReceiptUploadFailure(input: {
  stage?: ReceiptUploadStage | string | null;
  raw?: string | null;
  offline?: boolean;
}): { code: ReceiptUploadErrorCode; message: string; stage?: ReceiptUploadStage } {
  if (input.offline) {
    return {
      code: "connection_lost",
      message: MESSAGES.connection_lost,
      stage: "storage_upload",
    };
  }
  const raw = (input.raw ?? "").toLowerCase();
  const stage = (input.stage ?? "") as ReceiptUploadStage | "";

  if (
    raw.includes("not authenticated") ||
    raw.includes("jwt") ||
    raw.includes("session") ||
    raw.includes("401")
  ) {
    return { code: "session_expired", message: MESSAGES.session_expired, stage: stage || undefined };
  }
  if (
    raw.includes("heic") ||
    raw.includes("heif") ||
    raw.includes("iphone photo format")
  ) {
    return { code: "unsupported_heic", message: MESSAGES.unsupported_heic, stage: "client_validation" };
  }
  if (
    raw.includes("unsupported") ||
    raw.includes("only jpeg") ||
    raw.includes("file type") ||
    raw.includes("mime")
  ) {
    return {
      code: "unsupported_format",
      message: MESSAGES.unsupported_format,
      stage: "client_validation",
    };
  }
  if (
    raw.includes("too large") ||
    raw.includes("exceed") ||
    raw.includes("max") && raw.includes("byte") ||
    raw.includes("payload") ||
    raw.includes("413")
  ) {
    return { code: "image_too_large", message: MESSAGES.image_too_large, stage: "client_validation" };
  }
  if (
    raw.includes("could not read") ||
    raw.includes("decode") ||
    raw.includes("corrupt") ||
    raw.includes("bitmap") ||
    raw.includes("canvas")
  ) {
    return { code: "could_not_read", message: MESSAGES.could_not_read, stage: "preprocessing" };
  }
  if (
    stage === "ocr_processing" ||
    stage === "ocr_init" ||
    raw.includes("ocr") ||
    raw.includes("tesseract") ||
    raw.includes("ocr_worker") ||
    raw.includes("worker_timeout")
  ) {
    return { code: "ocr_failed", message: MESSAGES.ocr_failed, stage: "ocr_processing" };
  }
  if (
    stage === "storage_upload" ||
    stage === "registration" ||
    raw.includes("storage") ||
    raw.includes("upload") ||
    raw.includes("network") ||
    raw.includes("failed to fetch")
  ) {
    return { code: "could_not_upload", message: MESSAGES.could_not_upload, stage: stage || "storage_upload" };
  }
  return { code: "unknown", message: MESSAGES.unknown, stage: stage || undefined };
}
