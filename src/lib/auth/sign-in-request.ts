/** Pure helpers for POST /api/auth/sign-in (JSON + form). */

export type SignInContentMode = "json" | "form" | "unsupported";

export function detectSignInContentMode(
  contentType: string | null,
): SignInContentMode {
  if (!contentType) return "unsupported";
  const base = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base === "application/json") return "json";
  if (
    base === "application/x-www-form-urlencoded" ||
    base === "multipart/form-data"
  ) {
    return "form";
  }
  return "unsupported";
}

export type SignInErrorCode =
  | "invalid_credentials"
  | "validation"
  | "rate_limit"
  | "origin"
  | "profile"
  | "unsupported"
  | "server";

export function signInErrorLoginPath(code: SignInErrorCode): string {
  return `/login?error=${code}`;
}

export function mapSignInErrorMessage(code: SignInErrorCode): string {
  switch (code) {
    case "invalid_credentials":
      return "Unable to sign in with those credentials. Check your email and password.";
    case "validation":
      return "Valid email and password are required.";
    case "rate_limit":
      return "Too many sign-in attempts. Wait a minute and try again.";
    case "origin":
      return "Sign-in was blocked for security. Open https://household-os-five.vercel.app/login and try again.";
    case "profile":
      return "Signed in, but your profile could not be initialized. Open recovery or try again.";
    case "unsupported":
      return "Unsupported sign-in request.";
    default:
      return "Sign-in failed. Try again.";
  }
}

export function parseFormUrlEncoded(
  text: string,
): Record<string, string> {
  const params = new URLSearchParams(text);
  const out: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    out[key] = value;
  }
  return out;
}
