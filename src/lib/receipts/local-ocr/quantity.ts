import { parseCurrencyAmountToCents } from "../currency";

/** Parse quantity tokens from receipt lines (incl. weighted products). */

const QTY_AT_PRICE = /^(\d+(?:\.\d+)?)\s*[@x×]\s*\$?\s*(\d+(?:\.\d+)?)/i;
const QTY_PREFIX = /^(?:qty|qnty|quantity)?\s*(\d+(?:\.\d+)?)\s*[x×]\s+/i;
const WEIGHTED = /^(\d+(?:\.\d+)?)\s*(lb|lbs|kg|oz|g)\s*[@x×]\s*\$?\s*(\d+(?:\.\d+)?)/i;
const TRAILING_QTY = /\s+(\d+)\s*$/;

export type QuantityParse = {
  quantity: number | null;
  unitPriceCents: number | null;
  isWeighted: boolean;
  remainder: string;
};

export function parseQuantityExpression(line: string): QuantityParse {
  const text = line.trim();
  const weighted = text.match(WEIGHTED);
  if (weighted) {
    return {
      quantity: Number(weighted[1]),
      unitPriceCents: parseCurrencyAmountToCents(weighted[3]),
      isWeighted: true,
      remainder: text.slice(weighted[0].length).trim(),
    };
  }

  const atPrice = text.match(QTY_AT_PRICE);
  if (atPrice) {
    return {
      quantity: Number(atPrice[1]),
      unitPriceCents: parseCurrencyAmountToCents(atPrice[2]),
      isWeighted: false,
      remainder: text.slice(atPrice[0].length).trim(),
    };
  }

  const prefix = text.match(QTY_PREFIX);
  if (prefix) {
    return {
      quantity: Number(prefix[1]),
      unitPriceCents: null,
      isWeighted: false,
      remainder: text.slice(prefix[0].length).trim(),
    };
  }

  return {
    quantity: null,
    unitPriceCents: null,
    isWeighted: false,
    remainder: text,
  };
}

export function inferQuantityFromLine(
  description: string,
  totalPriceCents: number | null,
  unitPriceCents: number | null,
): number | null {
  const parsed = parseQuantityExpression(description);
  if (parsed.quantity !== null) return parsed.quantity;
  if (
    totalPriceCents !== null &&
    unitPriceCents !== null &&
    unitPriceCents !== 0 &&
    totalPriceCents % unitPriceCents === 0
  ) {
    return totalPriceCents / unitPriceCents;
  }
  const trailing = description.match(TRAILING_QTY);
  if (trailing) return Number(trailing[1]);
  return 1;
}
