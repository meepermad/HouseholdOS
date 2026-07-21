/** Origin checks for password sign-in Route Handler. */
export function isAllowedSignInOrigin(
  origin: string | null,
  appUrl: string,
  requestUrl: string,
): boolean {
  if (!origin) return false;
  let allowed: string;
  let requestOrigin: string;
  try {
    allowed = new URL(appUrl).origin;
    requestOrigin = new URL(requestUrl).origin;
  } catch {
    return false;
  }
  return origin === allowed || origin === requestOrigin;
}
