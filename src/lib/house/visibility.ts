import type {
  OwnershipMode,
  ResourceProjectionMode,
  ResourceVisibility,
} from "./types";

export const RESOURCE_VISIBILITIES = [
  "household",
  "owner_only",
  "selected_members",
] as const satisfies readonly ResourceVisibility[];

export const RESOURCE_VISIBILITY_LABELS: Record<ResourceVisibility, string> = {
  household: "Visible to household",
  owner_only: "Owner only",
  selected_members: "Selected members",
};

export type ResourceVisibilityInput = {
  visibility: ResourceVisibility;
  ownershipMode: OwnershipMode;
  ownerMembershipId: string | null;
  selectedMembershipIds: readonly string[];
  viewerMembershipId: string;
  /** Coordinators must not bypass owner_only personal pantry/inventory. */
  isHouseholdCoordinator: boolean;
};

/**
 * Resolve what a viewer may see. RLS is the real gate; this mirrors it for tests/UI.
 * owner_only → hidden for non-owners even if coordinator.
 */
export function resolveResourceProjection(
  input: ResourceVisibilityInput,
): ResourceProjectionMode {
  const {
    visibility,
    ownerMembershipId,
    selectedMembershipIds,
    viewerMembershipId,
  } = input;

  if (visibility === "household") return "full";

  if (visibility === "owner_only") {
    if (ownerMembershipId && ownerMembershipId === viewerMembershipId) {
      return "full";
    }
    return "hidden";
  }

  // selected_members
  if (ownerMembershipId && ownerMembershipId === viewerMembershipId) {
    return "full";
  }
  if (selectedMembershipIds.includes(viewerMembershipId)) return "full";
  return "hidden";
}

export function projectPersonalItemForViewer<T extends { id: string }>(params: {
  item: T;
  mode: ResourceProjectionMode;
}): T | null {
  if (params.mode === "hidden") return null;
  return params.item;
}

/** Default visibility for a given ownership mode. */
export function defaultVisibilityForOwnership(
  mode: OwnershipMode,
): ResourceVisibility {
  switch (mode) {
    case "personal":
    case "temporary":
      return "owner_only";
    case "shared_selected":
      return "selected_members";
    case "household":
    case "unknown":
    default:
      return "household";
  }
}

export function isHouseholdVisibleInventory(params: {
  visibility: ResourceVisibility;
  ownershipMode: OwnershipMode;
}): boolean {
  return (
    params.visibility === "household" ||
    (params.ownershipMode === "household" &&
      params.visibility !== "owner_only")
  );
}
