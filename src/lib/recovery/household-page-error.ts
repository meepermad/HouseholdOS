import { isDeploymentSkewError } from "@/lib/deployment-skew";
import { AppError } from "@/lib/errors";
import { isNextRedirectError } from "@/lib/navigation-errors";

export type HouseholdPageErrorKind =
  | "skew"
  | "session"
  | "authorization"
  | "not_found"
  | "timeout"
  | "receipt"
  | "generic";

export type HouseholdPageErrorCopy = {
  title: string;
  body: string;
  showLogout: boolean;
  kind: HouseholdPageErrorKind;
};

/**
 * Roommate-facing copy for the household route error boundary.
 * HEIC / receipt / redirect failures must not look like a crashed login.
 */
export function classifyHouseholdPageError(
  error: Error & { digest?: string },
): HouseholdPageErrorCopy {
  if (isDeploymentSkewError(error)) {
    return {
      title: "Update required",
      body: "HouseholdOS was redeployed. Refreshing to load the latest version…",
      showLogout: false,
      kind: "skew",
    };
  }

  const message = error.message.toLowerCase();
  if (
    isNextRedirectError(error) ||
    message.includes("next_redirect") ||
    message.includes("sign in") ||
    message.includes("session") ||
    message.includes("auth")
  ) {
    return {
      title: "Session expired",
      body: "Your session ended. Sign in again — this is not a password problem if you just signed in successfully.",
      showLogout: true,
      kind: "session",
    };
  }

  if (
    message.includes("heic") ||
    message.includes("heif") ||
    message.includes("iphone photo") ||
    message.includes("receipt")
  ) {
    return {
      title: "Could not add this receipt",
      body: "That photo could not be used. Try a JPEG or PNG, enter the purchase manually, or sign in again if your session expired.",
      showLogout: true,
      kind: "receipt",
    };
  }

  if (error instanceof AppError) {
    if (error.code === "authorization") {
      return {
        title: "Household unavailable",
        body: error.publicMessage,
        showLogout: true,
        kind: "authorization",
      };
    }
    if (error.code === "not_found") {
      return {
        title: "Household not found",
        body: error.publicMessage,
        showLogout: true,
        kind: "not_found",
      };
    }
    if (error.code === "database_failure") {
      const timedOut = error.publicMessage.toLowerCase().includes("timed out");
      return {
        title: timedOut ? "Load timed out" : "Database unavailable",
        body: error.publicMessage,
        showLogout: true,
        kind: timedOut ? "timeout" : "generic",
      };
    }
  }

  if (message.includes("timed out")) {
    return {
      title: "Load timed out",
      body: error.message,
      showLogout: true,
      kind: "timeout",
    };
  }

  return {
    title: "This page hit a problem",
    body: "Retry, return Home, or sign out. Your password was not rejected.",
    showLogout: true,
    kind: "generic",
  };
}

const HOUSEHOLD_RECEIPTS_PATH =
  /^\/app\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/money\/receipts/i;

export function householdReceiptsPathFromLocation(
  pathname: string | null | undefined,
): { householdId: string } | null {
  const match = (pathname ?? "").match(HOUSEHOLD_RECEIPTS_PATH);
  if (!match?.[1]) return null;
  return { householdId: match[1] };
}
