/**
 * Parse a pasted invitation token or /join/<token> URL.
 * Rejects unrelated URLs and empty input.
 */
export function parseInvitationPasteInput(raw: string): {
  ok: true;
  token: string;
} | {
  ok: false;
  error: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Paste an invitation token or join link." };
  }

  // Full URL containing /join/<token>
  if (/^https?:\/\//i.test(trimmed) || trimmed.includes("/join/")) {
    try {
      const withScheme = /^https?:\/\//i.test(trimmed)
        ? trimmed
        : `https://placeholder.local${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
      const url = new URL(withScheme);
      const match = url.pathname.match(/\/join\/([^/]+)\/?$/);
      if (!match?.[1]) {
        return {
          ok: false,
          error: "That URL is not a HouseholdOS invitation link.",
        };
      }
      const token = decodeURIComponent(match[1]).trim();
      if (token.length < 32 || token.length > 128) {
        return { ok: false, error: "Invalid invitation token." };
      }
      if (!/^[A-Za-z0-9_-]+$/.test(token)) {
        return { ok: false, error: "Invalid invitation token." };
      }
      return { ok: true, token };
    } catch {
      return {
        ok: false,
        error: "That URL is not a HouseholdOS invitation link.",
      };
    }
  }

  // Raw token
  if (trimmed.length < 32 || trimmed.length > 128) {
    return { ok: false, error: "Invalid invitation token." };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    return { ok: false, error: "Invalid invitation token." };
  }
  return { ok: true, token: trimmed };
}
