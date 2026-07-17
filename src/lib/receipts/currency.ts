/**
 * Parse currency display strings into integer cents.
 * Rejects non-finite and fractional-cent results.
 */

const CURRENCY_SYMBOLS = /[$€£¥]/g;

export function parseCurrencyAmountToCents(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    const cents = Math.round(raw * 100);
    return Number.isInteger(cents) ? cents : null;
  }
  let text = String(raw).trim();
  if (!text) return null;
  text = text.replace(CURRENCY_SYMBOLS, "").replace(/\s/g, "");
  // Parenthetical negatives: (12.34)
  let negative = false;
  if (text.startsWith("(") && text.endsWith(")")) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  }
  // Remove thousands separators
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) {
    text = text.replace(/,/g, "");
  } else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) {
    // European 1.234,56
    text = text.replace(/\./g, "").replace(",", ".");
  } else {
    text = text.replace(/,/g, "");
  }
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(value * 100) * (negative ? -1 : 1);
  return cents;
}

export function formatCentsAsUsd(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toFixed(2)}`;
}
