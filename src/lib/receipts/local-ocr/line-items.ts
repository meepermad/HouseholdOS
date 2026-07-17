import { parseCurrencyAmountToCents } from "../currency";
import { normalizeOcrLine } from "./normalize";
import { inferQuantityFromLine, parseQuantityExpression } from "./quantity";
import type { OcrLine, ProposedLineItem } from "./types";
import { toUserConfidenceState } from "./confidence-ui";
import type { ReceiptAlias } from "./types";
import { normalizeAliasKey } from "./normalize";

const SKIP_LINE =
  /\b(SUBTOTAL|SUB TOTAL|TOTAL|TAX|TIP|GRATUITY|CHANGE|CASH|TENDERED|BALANCE|AMOUNT DUE|VISA|MASTERCARD|AMEX|DEBIT|CREDIT|AUTH|APPROVED|THANK YOU|CARD\s*#|ACCOUNT)\b/i;

const PRICE_AT_END = /^(.*?)(-?\$?\d{1,3}(?:,\d{3})*\.\d{2}|-?\d+\.\d{2})\s*$/;
const CONTINUATION = /^(?:and\b|\+|\/|-)\s+/i;

function applyItemAlias(name: string, aliases: ReceiptAlias[], merchant: string | null): string {
  const key = normalizeAliasKey(name);
  const match = aliases.find((a) => {
    if (a.kind !== "item") return false;
    if (normalizeAliasKey(a.sourceText) !== key) return false;
    if (a.merchantScope && merchant) {
      return normalizeAliasKey(a.merchantScope) === normalizeAliasKey(merchant);
    }
    return true;
  });
  return match?.targetText ?? name;
}

export type LineGroupingResult = {
  items: ProposedLineItem[];
  unmatched: Array<{ text: string; pageNumber: number; bbox: OcrLine["bbox"] | null }>;
};

/**
 * Layout-aware grouping: left description + right price, with continuation lines.
 */
export function groupLineItems(
  lines: OcrLine[],
  options?: { aliases?: ReceiptAlias[]; merchant?: string | null },
): LineGroupingResult {
  const aliases = options?.aliases ?? [];
  const merchant = options?.merchant ?? null;
  const items: ProposedLineItem[] = [];
  const unmatched: LineGroupingResult["unmatched"] = [];
  let pendingContinuation: string | null = null;

  for (const line of lines) {
    const text = normalizeOcrLine(line.text);
    if (!text) continue;
    if (SKIP_LINE.test(text) && /\$?\d+\.\d{2}/.test(text)) {
      unmatched.push({ text, pageNumber: line.pageNumber, bbox: line.bbox });
      continue;
    }
    if (SKIP_LINE.test(text) && !/\$?\d+\.\d{2}/.test(text)) {
      unmatched.push({ text, pageNumber: line.pageNumber, bbox: line.bbox });
      continue;
    }

    if (CONTINUATION.test(text) && items.length > 0 && !PRICE_AT_END.test(text)) {
      const last = items[items.length - 1];
      last.ocrText = `${last.ocrText} ${text}`.trim();
      last.name = applyItemAlias(`${last.name} ${text.replace(CONTINUATION, "")}`.trim(), aliases, merchant);
      continue;
    }

    const priceMatch = text.match(PRICE_AT_END);
    if (!priceMatch) {
      if (pendingContinuation) {
        pendingContinuation = `${pendingContinuation} ${text}`;
      } else {
        pendingContinuation = text;
      }
      // Hold non-priced lines briefly; flush as unmatched if next isn't a price-only line
      continue;
    }

    let description = normalizeOcrLine(priceMatch[1]);
    const totalPriceCents = parseCurrencyAmountToCents(priceMatch[2]);
    if (pendingContinuation) {
      description = normalizeOcrLine(`${pendingContinuation} ${description}`);
      pendingContinuation = null;
    }

    if (!description || description.length < 1) {
      unmatched.push({ text, pageNumber: line.pageNumber, bbox: line.bbox });
      continue;
    }

    if (SKIP_LINE.test(description) && totalPriceCents !== null) {
      unmatched.push({ text, pageNumber: line.pageNumber, bbox: line.bbox });
      continue;
    }

    const qtyParsed = parseQuantityExpression(description);
    const desc = qtyParsed.remainder || description;
    const unitPriceCents = qtyParsed.unitPriceCents;
    const quantity = inferQuantityFromLine(desc, totalPriceCents, unitPriceCents);
    const isDiscount =
      /\b(discount|coupon|savings|-\s*\$)/i.test(desc) ||
      (totalPriceCents !== null && totalPriceCents < 0);
    const conf =
      (line.confidence > 1 ? line.confidence / 100 : line.confidence) || 0.6;

    items.push({
      ocrText: text,
      name: applyItemAlias(desc || description, aliases, merchant),
      quantity,
      unitPriceCents,
      totalPriceCents,
      confidence: conf,
      userState: toUserConfidenceState(conf),
      sourceBbox: line.bbox,
      pageNumber: line.pageNumber,
      reviewStatus: "pending",
      isDiscount,
      isWeighted: qtyParsed.isWeighted,
    });
  }

  if (pendingContinuation) {
    unmatched.push({
      text: pendingContinuation,
      pageNumber: lines[lines.length - 1]?.pageNumber ?? 1,
      bbox: null,
    });
  }

  return { items, unmatched };
}
