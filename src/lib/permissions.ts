export const HOUSEHOLD_ROLES = ["owner", "admin", "member"] as const;
export type HouseholdRole = (typeof HOUSEHOLD_ROLES)[number];

export const CAPABILITIES = [
  "household.view",
  "household.update",
  "household.archive",
  "member.invite",
  "invite.revoke",
  "member.change_role",
  "member.transfer_ownership",
  "member.remove",
  "member.leave",
  "audit.read",
  "settings.update",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const ROLE_CAPABILITIES: Record<HouseholdRole, readonly Capability[]> = {
  owner: [
    "household.view",
    "household.update",
    "household.archive",
    "member.invite",
    "invite.revoke",
    "member.change_role",
    "member.transfer_ownership",
    "member.remove",
    "audit.read",
    "settings.update",
  ],
  admin: [
    "household.view",
    "household.update",
    "member.invite",
    "invite.revoke",
    "member.change_role",
    "member.remove",
    "member.leave",
    "audit.read",
    "settings.update",
  ],
  member: ["household.view", "member.leave", "audit.read"],
};

export function can(role: HouseholdRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}

export function assertCan(role: HouseholdRole, capability: Capability): void {
  if (!can(role, capability)) {
    throw new Error(`Role '${role}' cannot perform '${capability}'`);
  }
}

/** Admin may demote admin→member and change member roles, but not touch owners. */
export function canChangeRole(params: {
  actorRole: HouseholdRole;
  targetCurrentRole: HouseholdRole;
  targetNextRole: HouseholdRole;
  actorIsTarget: boolean;
}): boolean {
  const { actorRole, targetCurrentRole, targetNextRole, actorIsTarget } = params;
  if (actorIsTarget) return false;
  if (actorRole === "owner") {
    // Owners may change non-owner roles; ownership itself uses transferOwnership.
    return targetCurrentRole !== "owner" && targetNextRole !== "owner";
  }
  if (actorRole === "admin") {
    if (targetCurrentRole === "owner" || targetNextRole === "owner") return false;
    if (targetCurrentRole === "admin" && targetNextRole !== "member") return false;
    return true;
  }
  return false;
}

export function canRemoveMember(params: {
  actorRole: HouseholdRole;
  targetRole: HouseholdRole;
  actorIsTarget: boolean;
}): boolean {
  const { actorRole, targetRole, actorIsTarget } = params;
  if (actorIsTarget) return can(actorRole, "member.leave");
  if (!can(actorRole, "member.remove")) return false;
  if (targetRole === "owner") return false;
  if (actorRole === "admin" && targetRole === "admin") return true;
  return true;
}
