/**
 * Resolve an invitation token from signup/login query params or a /join/{token} next path.
 */

const JOIN_TOKEN_RE = /^\/join\/([A-Za-z0-9_-]{32,128})$/;

export function extractInviteTokenFromNext(
  next: string | null | undefined,
): string | null {
  if (!next) return null;
  try {
    const raw = next.trim();
    const path = raw.startsWith("http://") || raw.startsWith("https://")
      ? new URL(raw).pathname
      : raw.split("?")[0] ?? raw;
    const match = path.match(JOIN_TOKEN_RE);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function resolveInviteToken(input: {
  invite?: string | null;
  next?: string | null;
}): string | null {
  const fromInvite = String(input.invite ?? "").trim();
  if (fromInvite.length >= 32) return fromInvite;
  return extractInviteTokenFromNext(input.next);
}
