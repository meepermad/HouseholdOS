/**
 * Origin checks for password sign-in Route Handler.
 * Allow APP_URL, the request host, and known production aliases.
 */

/** Extra production hosts that may serve the login document. */
export const SIGN_IN_ALIAS_HOSTS = [
  "household-os-meepermad.vercel.app",
] as const;

function normalizeOriginHeader(origin: string | null | undefined): string | null {
  if (!origin) return null;
  const trimmed = origin.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  return trimmed;
}

function originHost(origin: string): string | null {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

function isKnownAllowedOrigin(
  candidate: string,
  appUrl: string,
  requestUrl: string,
): boolean {
  let allowed: string;
  let requestOrigin: string;
  try {
    allowed = new URL(appUrl).origin;
    requestOrigin = new URL(requestUrl).origin;
  } catch {
    return false;
  }

  if (candidate === allowed || candidate === requestOrigin) return true;

  const host = originHost(candidate);
  if (!host) return false;
  if (SIGN_IN_ALIAS_HOSTS.includes(host as (typeof SIGN_IN_ALIAS_HOSTS)[number])) {
    return true;
  }
  // Preview / deployment hosts under the same Vercel project owner are same-site
  // only when they match the request host (already covered by requestOrigin).
  return false;
}

export function isAllowedSignInOrigin(
  origin: string | null,
  appUrl: string,
  requestUrl: string,
  referer?: string | null,
  secFetchSite?: string | null,
): boolean {
  const normalized = normalizeOriginHeader(origin);

  if (normalized) {
    return isKnownAllowedOrigin(normalized, appUrl, requestUrl);
  }

  // Some clients omit Origin on same-origin navigational POST; Referer may also
  // be absent when auth pages send Referrer-Policy: no-referrer.
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (isKnownAllowedOrigin(refOrigin, appUrl, requestUrl)) return true;
    } catch {
      // ignore
    }
  }

  // Browser reports same-origin fetch/navigation without a usable Origin.
  if (secFetchSite === "same-origin" || secFetchSite === "same-site") {
    return true;
  }

  return false;
}
