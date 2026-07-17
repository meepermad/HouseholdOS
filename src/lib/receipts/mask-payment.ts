/** Mask or discard sensitive payment information from OCR text. */

const CARD_PATTERN = /\b(?:\d[ -]*?){13,19}\b/g;
const CVV_PATTERN = /\b(?:cvv|cvc|cid)\s*[:#]?\s*\d{3,4}\b/gi;

export function maskPaymentInfo(text: string | null | undefined): string | null {
  if (!text) return null;
  let out = text.replace(CARD_PATTERN, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) return match;
    const last4 = digits.slice(-4);
    return `•••• ${last4}`;
  });
  out = out.replace(CVV_PATTERN, "[redacted]");
  return out;
}

export function containsFullCardNumber(text: string | null | undefined): boolean {
  if (!text) return false;
  const matches = text.match(CARD_PATTERN);
  if (!matches) return false;
  return matches.some((m) => {
    const digits = m.replace(/\D/g, "");
    return digits.length >= 13 && digits.length <= 19;
  });
}
