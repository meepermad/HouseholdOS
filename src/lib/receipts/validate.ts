import {
  RECEIPT_ALLOWED_MIME_TYPES,
  RECEIPT_MAX_BYTES,
  type ReceiptMimeType,
} from "./types";

const EXT_BY_MIME: Record<ReceiptMimeType, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "application/pdf": ["pdf"],
};

export type ReceiptValidationInput = {
  mimeType: string;
  fileName: string;
  sizeBytes: number;
};

export type ReceiptValidationResult =
  | { ok: true; mimeType: ReceiptMimeType; extension: string }
  | { ok: false; error: string };

export function validateReceiptUpload(
  input: ReceiptValidationInput,
): ReceiptValidationResult {
  if (input.sizeBytes <= 0 || input.sizeBytes > RECEIPT_MAX_BYTES) {
    return {
      ok: false,
      error: `File must be between 1 byte and ${RECEIPT_MAX_BYTES} bytes`,
    };
  }
  const mime = input.mimeType.toLowerCase().trim() as ReceiptMimeType;
  if (!(RECEIPT_ALLOWED_MIME_TYPES as readonly string[]).includes(mime)) {
    return {
      ok: false,
      error: "Only JPEG, PNG, WebP, and PDF receipts are allowed",
    };
  }
  const ext = (input.fileName.split(".").pop() ?? "").toLowerCase();
  const allowedExt = EXT_BY_MIME[mime];
  if (!allowedExt.includes(ext)) {
    return {
      ok: false,
      error: `File extension must match MIME type (${allowedExt.join(", ")})`,
    };
  }
  if (/\.(exe|bat|cmd|sh|js|mjs|php|html)$/i.test(input.fileName)) {
    return { ok: false, error: "Executable uploads are not permitted" };
  }
  return { ok: true, mimeType: mime, extension: ext === "jpeg" ? "jpg" : ext };
}

/**
 * Basic decompress-bomb heuristic for images: reject suspiciously small files
 * claiming huge dimensions when IHDR/width markers are present.
 * Full pixel decode happens server-side only when OCR runs.
 */
export function guardImageDecompression(
  bytes: Uint8Array,
  maxPixels: number,
): { ok: true } | { ok: false; error: string } {
  if (bytes.length < 24) return { ok: true };
  // PNG IHDR width/height at bytes 16–23
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const width =
      (bytes[16]! << 24) | (bytes[17]! << 16) | (bytes[18]! << 8) | bytes[19]!;
    const height =
      (bytes[20]! << 24) | (bytes[21]! << 16) | (bytes[22]! << 8) | bytes[23]!;
    if (width > 0 && height > 0 && width * height > maxPixels) {
      return { ok: false, error: "Image dimensions exceed safe limits" };
    }
  }
  return { ok: true };
}
