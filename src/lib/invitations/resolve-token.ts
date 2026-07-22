/**
 * Resolve an invitation token from signup/login query params or invite next paths.
 */

const JOIN_TOKEN_RE = /^\/join\/([A-Za-z0-9_-]{32,128})$/;
const CREATE_HOUSEHOLD_TOKEN_RE =
  /^\/register\/create-household\/([A-Za-z0-9_-]{32,128})$/;

function pathFromNext(next: string | null | undefined): string | null {
  if (!next) return null;
  try {
    const raw = next.trim();
    return raw.startsWith("http://") || raw.startsWith("https://")
      ? new URL(raw).pathname
      : (raw.split("?")[0]?.split("#")[0] ?? raw);
  } catch {
    return null;
  }
}

export function extractInviteTokenFromNext(
  next: string | null | undefined,
): string | null {
  const path = pathFromNext(next);
  if (!path) return null;
  const join = path.match(JOIN_TOKEN_RE);
  if (join?.[1]) return join[1];
  const create = path.match(CREATE_HOUSEHOLD_TOKEN_RE);
  return create?.[1] ?? null;
}

export function isCreateHouseholdRegistrationPath(
  next: string | null | undefined,
): boolean {
  const path = pathFromNext(next);
  return Boolean(path && CREATE_HOUSEHOLD_TOKEN_RE.test(path));
}

export function resolveInviteToken(input: {
  invite?: string | null;
  next?: string | null;
}): string | null {
  const fromInvite = String(input.invite ?? "").trim();
  if (fromInvite.length >= 32) return fromInvite;
  return extractInviteTokenFromNext(input.next);
}
