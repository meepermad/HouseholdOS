/** Maximum pasted receipt length. Larger input is rejected, not truncated. */
export const PASTE_MAX_CHARS = 32_000;

const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export type SanitizePasteResult =
  | { ok: true; text: string }
  | { ok: false; error: "empty" | "too_large" };

/**
 * Treat paste as untrusted text: normalize newlines, strip control chars,
 * reject oversized input. Does not interpret HTML or markdown.
 */
export function sanitizePastedReceipt(raw: string | null | undefined): SanitizePasteResult {
  if (raw == null) return { ok: false, error: "empty" };
  if (raw.length > PASTE_MAX_CHARS) return { ok: false, error: "too_large" };
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(CONTROL_RE, "");
  if (!text.trim()) return { ok: false, error: "empty" };
  return { ok: true, text };
}

/** Escape text for safe HTML text-node display. Never pass paste to innerHTML. */
export function escapePastedText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
