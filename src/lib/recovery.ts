import { CURRENT_HOUSEHOLD_COOKIE, safeRedirectPath } from "@/lib/navigation";

/** Cookie clear options matching how HouseholdOS sets the household preference. */
export function householdCookieClearOptions(secure = process.env.NODE_ENV === "production") {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: 0,
  };
}

export type RecoveryState =
  | "unexpected"
  | "household_not_found"
  | "membership_inactive"
  | "stale_selection"
  | "session_expired"
  | "database_unavailable"
  | "signed_out";

export function classifyRecoveryReason(
  reason: string | null | undefined,
): RecoveryState {
  switch (reason) {
    case "household_not_found":
    case "membership_inactive":
    case "stale_selection":
    case "session_expired":
    case "database_unavailable":
    case "signed_out":
      return reason;
    default:
      return "unexpected";
  }
}

export function recoveryCopy(state: RecoveryState): {
  title: string;
  body: string;
} {
  switch (state) {
    case "household_not_found":
      return {
        title: "Household unavailable",
        body: "That household could not be found, or you no longer have access.",
      };
    case "membership_inactive":
      return {
        title: "Membership changed",
        body: "Your household membership is no longer active. Choose another household or sign out.",
      };
    case "stale_selection":
      return {
        title: "Selected household is out of date",
        body: "Clear the selected household and pick one you can access.",
      };
    case "session_expired":
      return {
        title: "Session expired",
        body: "Sign in again to continue.",
      };
    case "database_unavailable":
      return {
        title: "Temporarily unavailable",
        body: "HouseholdOS could not reach its data store. Try again or sign out.",
      };
    case "signed_out":
      return {
        title: "Signed out",
        body: "You have been signed out of HouseholdOS.",
      };
    default:
      return {
        title: "Something went wrong",
        body: "HouseholdOS hit a problem while loading. Retry from here, clear your household selection, or sign out.",
      };
  }
}

/** Safe internal destinations after clear-household / recovery navigation. */
export function safeRecoveryDestination(
  candidate: string | null | undefined,
): string {
  const path = safeRedirectPath(candidate, "/app");
  // Never bounce recovery back into a specific household URL.
  if (/^\/app\/[0-9a-f-]{36}/i.test(path)) return "/app";
  if (path.startsWith("/recovery")) return "/app";
  if (path.startsWith("/auth/")) return "/app";
  return path === "/" ? "/app" : path;
}

export function formatErrorReference(digest: string | undefined): string | null {
  if (!digest) return null;
  const cleaned = digest.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return cleaned.length > 0 ? cleaned : null;
}

export const APP_CONTEXT_COOKIE_NAMES = [CURRENT_HOUSEHOLD_COOKIE] as const;
