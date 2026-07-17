import type { GovernanceStatus } from "./types";

/** Allowed lifecycle edges — mirrored in SQL `_governance_assert_lifecycle`. */
const ALLOWED: Record<GovernanceStatus, readonly GovernanceStatus[]> = {
  draft: ["proposed", "archived", "withdrawn"],
  proposed: ["under_review", "withdrawn", "rejected"],
  under_review: ["approved", "rejected", "withdrawn", "proposed"],
  approved: ["active", "archived", "superseded"],
  active: ["superseded", "archived"],
  superseded: ["archived"],
  archived: [],
  rejected: ["draft", "archived"],
  withdrawn: ["draft", "archived"],
};

export function canTransitionGovernanceStatus(
  from: GovernanceStatus,
  to: GovernanceStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertGovernanceLifecycle(
  from: GovernanceStatus,
  to: GovernanceStatus,
): void {
  if (!canTransitionGovernanceStatus(from, to)) {
    throw new Error(`Invalid governance lifecycle transition: ${from} -> ${to}`);
  }
}

export function isEditableDraftStatus(status: GovernanceStatus): boolean {
  return status === "draft" || status === "rejected" || status === "withdrawn";
}

export function isImmutableVersionStatus(status: GovernanceStatus): boolean {
  return status === "approved" || status === "active" || status === "superseded";
}
