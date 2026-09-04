/**
 * Integer-cents parsing for pasted receipt amounts.
 * Never multiplies IEEE floats to store money.
 */

/** Reject amounts at or above $1,000,000.00 as unsafe overflow. */
export const PASTE_MAX_ABS_CENTS = 100_000_000;

export type CentsParseError =
  | "empty"
  | "malformed"
  | "overflow"
  | "negative";

export type CentsParseResult =
  | { ok: true; cents: number }
  | { ok: false; error: CentsParseError };

function stripCurrencyDecor(raw: string): string {
  return raw
    .replace(/[$€£¥]/g, "")
    .replace(/\s+/g, "")
    .replace(/usd/gi, "");
}

/**
 * Parse a human dollar string into integer cents.
 * Accepts 84, 84.7, 84.72, $84.72. Rejects NaN, extra decimals, overflow.
 */
export function parsePastedCents(
  raw: string | null | undefined,
  options?: { allowNegative?: boolean },
): CentsParseResult {
  if (raw == null) return { ok: false, error: "empty" };
  let text = stripCurrencyDecor(String(raw).trim());
  if (!text) return { ok: false, error: "empty" };

  let negative = false;
  if (text.startsWith("(") && text.endsWith(")")) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (text.startsWith("+")) text = text.slice(1);
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  }
  if (!text) return { ok: false, error: "malformed" };

  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) {
    text = text.replace(/,/g, "");
  } else {
    text = text.replace(/,/g, "");
  }

  if (!/^\d+(\.\d+)?$/.test(text)) return { ok: false, error: "malformed" };

  const [wholeRaw, fracRaw = ""] = text.split(".");
  if (fracRaw.length > 2) return { ok: false, error: "malformed" };
  const whole = wholeRaw === "" ? 0 : Number.parseInt(wholeRaw, 10);
  const frac = fracRaw.length === 0 ? 0 : Number.parseInt(fracRaw.padEnd(2, "0"), 10);
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(frac)) {
    return { ok: false, error: "overflow" };
  }
  if (whole > Math.floor(PASTE_MAX_ABS_CENTS / 100)) {
    return { ok: false, error: "overflow" };
  }
  const cents = whole * 100 + frac;
  if (cents >= PASTE_MAX_ABS_CENTS) return { ok: false, error: "overflow" };
  if (negative && !options?.allowNegative) return { ok: false, error: "negative" };
  const signed = negative ? -cents : cents;
  if (!Number.isSafeInteger(signed)) return { ok: false, error: "overflow" };
  return { ok: true, cents: signed };
}

export function formatPastedUsd(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}$${whole}.${frac}`;
}
