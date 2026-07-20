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

const MAX_IMAGE_PIXELS = 40_000_000;
const MAX_PDF_PAGES = 30;

export type ReceiptValidationInput = {
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  /** Optional file bytes for magic-byte verification. */
  bytes?: Uint8Array;
};

export type ReceiptValidationResult =
  | { ok: true; mimeType: ReceiptMimeType; extension: string }
  | { ok: false; error: string };

function sniffMime(bytes: Uint8Array): ReceiptMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return "application/pdf";
  }
  return null;
}

function countPdfPages(bytes: Uint8Array): number | null {
  try {
    const text = new TextDecoder("latin1").decode(bytes.slice(0, Math.min(bytes.length, 2_000_000)));
    if (/\/Encrypt\b/.test(text)) return -1; // encrypted
    const matches = text.match(/\/Type\s*\/Page\b/g);
    return matches ? matches.length : null;
  } catch {
    return null;
  }
}

export function validateReceiptUpload(
  input: ReceiptValidationInput,
): ReceiptValidationResult {
  if (input.sizeBytes <= 0 || input.sizeBytes > RECEIPT_MAX_BYTES) {
    return {
      ok: false,
      error: `File must be between 1 byte and ${RECEIPT_MAX_BYTES} bytes`,
    };
  }
  const declared = input.mimeType.toLowerCase().trim() as ReceiptMimeType;
  if (!(RECEIPT_ALLOWED_MIME_TYPES as readonly string[]).includes(declared)) {
    return {
      ok: false,
      error: "Only JPEG, PNG, WebP, and PDF receipts are allowed",
    };
  }
  const ext = (input.fileName.split(".").pop() ?? "").toLowerCase();
  const allowedExt = EXT_BY_MIME[declared];
  if (!allowedExt.includes(ext)) {
    return {
      ok: false,
      error: `File extension must match MIME type (${allowedExt.join(", ")})`,
    };
  }
  if (/\.(exe|bat|cmd|sh|js|mjs|php|html)$/i.test(input.fileName)) {
    return { ok: false, error: "Executable uploads are not permitted" };
  }

  if (input.bytes && input.bytes.length > 0) {
    const sniffed = sniffMime(input.bytes);
    if (!sniffed) {
      return { ok: false, error: "File signature does not match a supported receipt type" };
    }
    if (sniffed !== declared) {
      return {
        ok: false,
        error: `Declared MIME (${declared}) does not match file signature (${sniffed})`,
      };
    }
    const bomb = guardImageDecompression(input.bytes, MAX_IMAGE_PIXELS);
    if (!bomb.ok) return bomb;
    if (sniffed === "application/pdf") {
      const pages = countPdfPages(input.bytes);
      if (pages === -1) {
        return { ok: false, error: "Encrypted PDFs are not supported" };
      }
      if (pages !== null && pages > MAX_PDF_PAGES) {
        return { ok: false, error: `PDF exceeds ${MAX_PDF_PAGES} page limit` };
      }
    }
  }

  return { ok: true, mimeType: declared, extension: ext === "jpeg" ? "jpg" : ext };
}

/**
 * Basic decompress-bomb heuristic for images: reject suspiciously small files
 * claiming huge dimensions when IHDR/width markers are present.
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
  // JPEG SOF0/SOF2 dimensions
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = bytes[i + 1]!;
      if (marker === 0xc0 || marker === 0xc2) {
        const height = (bytes[i + 5]! << 8) | bytes[i + 6]!;
        const width = (bytes[i + 7]! << 8) | bytes[i + 8]!;
        if (width > 0 && height > 0 && width * height > maxPixels) {
          return { ok: false, error: "Image dimensions exceed safe limits" };
        }
        break;
      }
      if (marker === 0xd9 || marker === 0xda) break;
      const len = (bytes[i + 2]! << 8) | bytes[i + 3]!;
      if (len < 2) break;
      i += 2 + len;
    }
  }
  return { ok: true };
}

export { MAX_IMAGE_PIXELS, MAX_PDF_PAGES, sniffMime };
