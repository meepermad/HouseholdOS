import type { OwnershipMode } from "./types";

export const OWNERSHIP_MODES = [
  "household",
  "personal",
  "shared_selected",
  "temporary",
  "unknown",
] as const satisfies readonly OwnershipMode[];

export const OWNERSHIP_MODE_LABELS: Record<OwnershipMode, string> = {
  household: "Household",
  personal: "Personal",
  shared_selected: "Shared (selected members)",
  temporary: "Temporary / loaned",
  unknown: "Unknown — needs clarification",
};

export type OwnershipValidationInput = {
  mode: OwnershipMode;
  ownerMembershipId: string | null | undefined;
  sharedMembershipIds?: readonly string[] | null;
  /** Memberships that belong to this household (active). */
  householdMembershipIds: readonly string[];
};

export type OwnershipValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Validate ownership mode + owner membership consistency.
 * Does not infer ownership from expense payer.
 */
export function validateOwnership(
  input: OwnershipValidationInput,
): OwnershipValidationResult {
  const { mode, ownerMembershipId, sharedMembershipIds, householdMembershipIds } =
    input;
  const inHousehold = (id: string) => householdMembershipIds.includes(id);

  switch (mode) {
    case "household":
    case "unknown":
      if (ownerMembershipId) {
        return {
          ok: false,
          error: `${mode} ownership must not set a personal owner`,
        };
      }
      if (sharedMembershipIds && sharedMembershipIds.length > 0) {
        return {
          ok: false,
          error: `${mode} ownership must not list shared members`,
        };
      }
      return { ok: true };

    case "personal":
    case "temporary": {
      if (!ownerMembershipId) {
        return {
          ok: false,
          error: `${mode} ownership requires an owner membership`,
        };
      }
      if (!inHousehold(ownerMembershipId)) {
        return {
          ok: false,
          error: "Owner must be an active member of this household",
        };
      }
      return { ok: true };
    }

    case "shared_selected": {
      const members = sharedMembershipIds ?? [];
      if (members.length < 2) {
        return {
          ok: false,
          error: "shared_selected ownership requires at least two members",
        };
      }
      for (const id of members) {
        if (!inHousehold(id)) {
          return {
            ok: false,
            error: "Shared ownership members must belong to this household",
          };
        }
      }
      return { ok: true };
    }

    default:
      return { ok: false, error: "Unknown ownership mode" };
  }
}

export function canTransferOwnership(params: {
  actorMembershipId: string;
  currentMode: OwnershipMode;
  currentOwnerMembershipId: string | null;
  isHouseholdCoordinator: boolean;
}): boolean {
  if (params.isHouseholdCoordinator) return true;
  if (
    params.currentMode === "personal" ||
    params.currentMode === "temporary"
  ) {
    return params.currentOwnerMembershipId === params.actorMembershipId;
  }
  // Communal / unknown: any active member may propose; coordinator override for force
  return (
    params.currentMode === "household" || params.currentMode === "unknown"
  );
}

/**
 * Ownership is distinct from who bought the item.
 * Never use expense payer as sole ownership signal.
 */
export function ownershipFromExpensePayer(_payerMembershipId: string): null {
  void _payerMembershipId;
  return null;
}
