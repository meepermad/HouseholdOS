import type { HouseholdResponsibility } from "@/types/database";

export const HOUSEHOLD_RESPONSIBILITIES = [
  "member",
  "household_coordinator",
  "financial_coordinator",
] as const;

export type { HouseholdResponsibility };

export const CAPABILITIES = [
  "household.view",
  "household.update",
  "household.archive",
  "member.invite",
  "invite.revoke",
  "member.change_roles",
  "member.remove",
  "member.leave",
  "audit.read",
  "settings.update",
  "expense.create",
  "expense.view",
  "expense.confirm",
  "expense.void",
  "expense.amend",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const EXPENSE_CAPABILITIES = [
  "expense.create",
  "expense.view",
  "expense.confirm",
  "expense.void",
  "expense.amend",
] as const satisfies readonly Capability[];

const ROLE_CAPABILITIES: Record<HouseholdResponsibility, readonly Capability[]> = {
  member: [
    "household.view",
    "member.leave",
    "audit.read",
    ...EXPENSE_CAPABILITIES,
  ],
  household_coordinator: [
    "household.view",
    "household.update",
    "household.archive",
    "member.invite",
    "invite.revoke",
    "member.change_roles",
    "member.remove",
    "member.leave",
    "audit.read",
    "settings.update",
    ...EXPENSE_CAPABILITIES,
  ],
  financial_coordinator: [
    "household.view",
    "settings.update",
    "audit.read",
    "member.leave",
    ...EXPENSE_CAPABILITIES,
  ],
};

export function unionCapabilities(
  roles: readonly HouseholdResponsibility[],
): Capability[] {
  const set = new Set<Capability>();
  for (const role of roles) {
    for (const capability of ROLE_CAPABILITIES[role] ?? []) {
      set.add(capability);
    }
  }
  return [...set];
}

export function can(
  roles: readonly HouseholdResponsibility[],
  capability: Capability,
): boolean {
  return unionCapabilities(roles).includes(capability);
}

export function assertCan(
  roles: readonly HouseholdResponsibility[],
  capability: Capability,
): void {
  if (!can(roles, capability)) {
    throw new Error(`Roles cannot perform '${capability}'`);
  }
}

export function isHouseholdCoordinator(
  roles: readonly HouseholdResponsibility[],
): boolean {
  return roles.includes("household_coordinator");
}

/** Prevent self-promotion and unauthorized grants. */
export function canChangeRoles(params: {
  actorRoles: readonly HouseholdResponsibility[];
  actorIsTarget: boolean;
  nextRoles: readonly HouseholdResponsibility[];
}): boolean {
  const { actorRoles, actorIsTarget, nextRoles } = params;
  if (actorIsTarget) return false;
  if (!can(actorRoles, "member.change_roles")) return false;
  if (!nextRoles.includes("member")) return false;
  for (const role of nextRoles) {
    if (!HOUSEHOLD_RESPONSIBILITIES.includes(role)) return false;
  }
  return true;
}

export function canRemoveMember(params: {
  actorRoles: readonly HouseholdResponsibility[];
  actorIsTarget: boolean;
}): boolean {
  const { actorRoles, actorIsTarget } = params;
  if (actorIsTarget) return can(actorRoles, "member.leave");
  return can(actorRoles, "member.remove");
}

export function normalizeRoles(
  roles: readonly HouseholdResponsibility[],
): HouseholdResponsibility[] {
  const set = new Set<HouseholdResponsibility>(roles);
  set.add("member");
  return HOUSEHOLD_RESPONSIBILITIES.filter((r) => set.has(r));
}
