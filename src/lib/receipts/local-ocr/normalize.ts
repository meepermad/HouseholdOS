/** Normalize OCR lines for deterministic receipt parsing. */

const MULTI_SPACE = /\s+/g;
const NON_PRINTABLE = /[^\S\n\r\t]+/g;

export function normalizeOcrLine(raw: string): string {
  return String(raw ?? "")
    .replace(NON_PRINTABLE, " ")
    .replace(MULTI_SPACE, " ")
    .trim();
}

export function normalizeOcrText(raw: string): string {
  return String(raw ?? "")
    .split(/\r?\n/)
    .map(normalizeOcrLine)
    .filter(Boolean)
    .join("\n");
}

export function normalizeAliasKey(raw: string): string {
  return normalizeOcrLine(raw)
    .toUpperCase()
    .replace(/[^A-Z0-9%#]+/g, " ")
    .replace(MULTI_SPACE, " ")
    .trim();
}

export function stripReceiptNoise(line: string): string {
  return normalizeOcrLine(line)
    .replace(/[|¦]/g, "I")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}
