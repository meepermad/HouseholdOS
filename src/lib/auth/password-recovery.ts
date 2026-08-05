/**
 * Password recovery error codes and public copy.
 * Never include emails, tokens, or raw Supabase messages in redirects.
 */

export type RecoveryAuthErrorCode =
  | "link_expired"
  | "link_invalid"
  | "link_used"
  | "auth_failed"
  | "session_expired"
  | "rate_limit"
  | "validation"
  | "mismatch"
  | "weak_password"
  | "origin"
  | "password_updated";

const RECOVERY_CODES = new Set<string>([
  "link_expired",
  "link_invalid",
  "link_used",
  "auth_failed",
  "session_expired",
  "rate_limit",
  "validation",
  "mismatch",
  "weak_password",
  "origin",
  "password_updated",
]);

export function isRecoveryAuthErrorCode(
  value: string | null | undefined,
): value is RecoveryAuthErrorCode {
  return Boolean(value && RECOVERY_CODES.has(value));
}

export function mapRecoveryAuthErrorMessage(
  code: RecoveryAuthErrorCode,
): string {
  switch (code) {
    case "link_expired":
      return "This reset link has expired. Request a new one.";
    case "link_invalid":
      return "This reset link is invalid. Request a new one.";
    case "link_used":
      return "This reset link has already been used. Request a new one.";
    case "auth_failed":
      return "Unable to complete password recovery. Request a new link.";
    case "session_expired":
      return "Your reset session expired. Request a new password reset link.";
    case "rate_limit":
      return "Too many attempts. Wait a minute and try again.";
    case "validation":
      return "Enter a valid email address.";
    case "mismatch":
      return "Passwords do not match.";
    case "weak_password":
      return "Password must be at least 8 characters.";
    case "origin":
      return "Request blocked for security. Open the app from the official site and try again.";
    case "password_updated":
      return "Password updated. Sign in with your new password.";
    default:
      return "Password recovery failed. Try again.";
  }
}

/** Classify Supabase / OAuth error_description into a safe code. */
export function classifyCallbackAuthError(
  errorCode: string | null,
  errorDescription: string | null,
): RecoveryAuthErrorCode {
  const blob = `${errorCode ?? ""} ${errorDescription ?? ""}`.toLowerCase();
  if (blob.includes("expired")) return "link_expired";
  if (blob.includes("already") || blob.includes("used") || blob.includes("reuse")) {
    return "link_used";
  }
  if (blob.includes("invalid") || blob.includes("otp") || blob.includes("token")) {
    return "link_invalid";
  }
  return "auth_failed";
}

export const GENERIC_FORGOT_SUCCESS =
  "If an account exists for that email, you will receive password reset instructions.";

/** Paths allowed as `next` after recovery callback (internal only). */
export function isAllowedRecoveryNext(path: string): boolean {
  if (path === "/reset-password") return true;
  if (path === "/app" || path.startsWith("/app/")) return true;
  if (path === "/onboarding" || path.startsWith("/onboarding/")) return true;
  if (path.startsWith("/join/")) return true;
  return false;
}
