import type { MembershipStatus } from "@/types/database";

const ACTIVE_TRANSITIONS: Record<MembershipStatus, readonly MembershipStatus[]> = {
  invited: ["active", "former", "removed"],
  active: ["leaving", "former", "removed"],
  leaving: ["former", "active", "removed"],
  former: ["active"],
  removed: [],
};

export function canTransitionMembership(
  from: MembershipStatus,
  to: MembershipStatus,
): boolean {
  if (from === to) return true;
  return ACTIVE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function losesHouseholdAccess(status: MembershipStatus): boolean {
  return status === "former" || status === "removed" || status === "invited";
}

export function isActiveMembership(status: MembershipStatus): boolean {
  return status === "active" || status === "leaving";
}
