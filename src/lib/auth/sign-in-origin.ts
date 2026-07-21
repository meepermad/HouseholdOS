/** Origin checks for password sign-in Route Handler. */
export function isAllowedSignInOrigin(
  origin: string | null,
  appUrl: string,
  requestUrl: string,
  referer?: string | null,
): boolean {
  let allowed: string;
  let requestOrigin: string;
  try {
    allowed = new URL(appUrl).origin;
    requestOrigin = new URL(requestUrl).origin;
  } catch {
    return false;
  }

  if (origin) {
    return origin === allowed || origin === requestOrigin;
  }

  // Some no-JS / older clients omit Origin on same-origin navigational POST.
  // Accept only when Referer is same-origin (never allow blank both).
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      return refOrigin === allowed || refOrigin === requestOrigin;
    } catch {
      return false;
    }
  }

  return false;
}
