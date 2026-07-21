import {
  isHouseholdId,
  safeRedirectPath,
} from "@/lib/navigation";

/**
 * Resolve where to send the browser after a successful password sign-in.
 * Validates household-scoped deep links against active memberships.
 */
export function resolvePostAuthDestination(params: {
  requestedNext: string | null | undefined;
  authorizedHouseholdIds: readonly string[];
  preferredHouseholdId: string | null;
}): string {
  const authorized = params.authorizedHouseholdIds;
  const path = safeRedirectPath(params.requestedNext, "/app");

  const householdMatch = path.match(
    /^\/app\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(\/.*)?$/i,
  );

  if (householdMatch) {
    const householdId = householdMatch[1]!;
    const rest = householdMatch[2] ?? "";
    if (authorized.includes(householdId)) {
      return `/app/${householdId}${rest}`;
    }
    // Stale/unauthorized household must not look like a credential failure.
    if (params.preferredHouseholdId) {
      return `/app/${params.preferredHouseholdId}`;
    }
    return authorized.length > 0 ? "/onboarding" : "/onboarding";
  }

  if (path === "/app" || path.startsWith("/app?")) {
    if (params.preferredHouseholdId) {
      return `/app/${params.preferredHouseholdId}`;
    }
    return authorized.length > 0 ? "/onboarding" : "/onboarding";
  }

  if (path.startsWith("/onboarding") || path.startsWith("/join/")) {
    return path;
  }

  if (authorized.length === 0) return "/onboarding";
  if (params.preferredHouseholdId) return `/app/${params.preferredHouseholdId}`;
  return "/onboarding";
}

export function extractHouseholdIdFromAppPath(
  path: string,
): string | null {
  const match = path.match(/^\/app\/([0-9a-f-]{36})(?:\/|$)/i);
  if (!match?.[1] || !isHouseholdId(match[1])) return null;
  return match[1];
}
