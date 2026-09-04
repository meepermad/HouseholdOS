/**
 * HEIC/HEIF detection for receipt uploads.
 * Conversion (when the browser can decode the image) lives in normalize-upload.
 */

export const HEIC_BRANDS = new Set([
  "heic",
  "heif",
  "mif1",
  "msf1",
  "heix",
  "hevc",
  "hevx",
]);

export function isHeicMime(mimeType: string | null | undefined): boolean {
  const mime = (mimeType ?? "").toLowerCase();
  return (
    mime === "image/heic" ||
    mime === "image/heif" ||
    mime === "image/heic-sequence" ||
    mime === "image/heif-sequence"
  );
}

export function isHeicFileName(fileName: string | null | undefined): boolean {
  const name = (fileName ?? "").toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
}

/** ISO BMFF `ftyp` brand at bytes 8–11 after a 4-byte size + 'ftyp'. */
export function sniffHeicBrand(bytes: Uint8Array | null | undefined): boolean {
  if (!bytes || bytes.length < 12) return false;
  const ftyp = String.fromCharCode(bytes[4]!, bytes[5]!, bytes[6]!, bytes[7]!);
  if (ftyp !== "ftyp") return false;
  const brand = String.fromCharCode(
    bytes[8]!,
    bytes[9]!,
    bytes[10]!,
    bytes[11]!,
  ).toLowerCase();
  return HEIC_BRANDS.has(brand);
}

export function detectHeic(input: {
  bytes?: Uint8Array | null;
  mimeType?: string | null;
  fileName?: string | null;
}): boolean {
  if (isHeicMime(input.mimeType)) return true;
  if (isHeicFileName(input.fileName)) return true;
  return sniffHeicBrand(input.bytes);
}
