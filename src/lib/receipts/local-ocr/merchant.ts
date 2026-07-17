import { normalizeAliasKey, normalizeOcrLine } from "./normalize";
import type { OcrLine, ReceiptAlias } from "./types";

const NON_MERCHANT_HEADERS = [
  "RECEIPT",
  "CUSTOMER COPY",
  "MERCHANT COPY",
  "THANK YOU",
  "WELCOME",
  "TAX INVOICE",
  "INVOICE",
  "ORDER #",
  "ORDER NUMBER",
  "TRANSACTION",
  "WWW.",
  "HTTP",
  "TEL",
  "PHONE",
  "FAX",
  "STORE #",
  "REGISTER",
];

export type MerchantCandidate = {
  value: string;
  confidence: number;
  sourceText: string;
  pageNumber: number;
  bbox: OcrLine["bbox"] | null;
};

function isExcludedHeader(line: string): boolean {
  const upper = line.toUpperCase();
  return NON_MERCHANT_HEADERS.some((h) => upper.includes(h) || upper.startsWith(h));
}

function looksLikeAddressOrPhone(line: string): boolean {
  if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(line)) return true;
  if (/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/.test(line)) return true;
  if (/^\d+\s+\w+/.test(line) && /\b(ST|AVE|RD|BLVD|DR|LN|WAY)\b/i.test(line)) {
    return true;
  }
  return false;
}

function looksLikeMoneyOrTotal(line: string): boolean {
  return /\$?\d+\.\d{2}/.test(line) || /\b(TOTAL|SUBTOTAL|TAX|CHANGE)\b/i.test(line);
}

/**
 * Prefer prominent early lines; apply household merchant aliases when present.
 */
export function selectMerchantCandidate(
  lines: OcrLine[],
  aliases: ReceiptAlias[] = [],
): MerchantCandidate | null {
  const early = lines
    .filter((l) => l.pageNumber === 1 || l.pageNumber === lines[0]?.pageNumber)
    .slice(0, 12);

  const scored: MerchantCandidate[] = [];

  for (let i = 0; i < early.length; i++) {
    const line = early[i];
    const text = normalizeOcrLine(line.text);
    if (!text || text.length < 2) continue;
    if (isExcludedHeader(text)) continue;
    if (looksLikeAddressOrPhone(text)) continue;
    if (looksLikeMoneyOrTotal(text)) continue;
    if (/^\d+$/.test(text)) continue;

    const height = Math.max(1, line.bbox.y1 - line.bbox.y0);
    const prominence = Math.min(1, height / 40);
    const positionBoost = Math.max(0, 1 - i * 0.08);
    let confidence = 0.45 + prominence * 0.35 + positionBoost * 0.2;
    confidence = Math.min(0.95, confidence * (line.confidence > 1 ? line.confidence / 100 : line.confidence || 0.7));

    const alias = aliases.find(
      (a) =>
        a.kind === "merchant" &&
        normalizeAliasKey(a.sourceText) === normalizeAliasKey(text),
    );
    const value = alias?.targetText ?? text;

    scored.push({
      value,
      confidence: alias ? Math.min(0.98, confidence + 0.1) : confidence,
      sourceText: text,
      pageNumber: line.pageNumber,
      bbox: line.bbox,
    });
  }

  scored.sort((a, b) => b.confidence - a.confidence);
  return scored[0] ?? null;
}

export function extractStoreLocation(lines: OcrLine[]): {
  value: string | null;
  sourceText: string | null;
  confidence: number;
} {
  for (const line of lines.slice(1, 8)) {
    const text = normalizeOcrLine(line.text);
    if (looksLikeAddressOrPhone(text)) {
      return { value: text, sourceText: text, confidence: 0.7 };
    }
  }
  return { value: null, sourceText: null, confidence: 0 };
}
