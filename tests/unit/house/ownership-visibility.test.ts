import { describe, expect, it } from "vitest";
import {
  canTransferOwnership,
  ownershipFromExpensePayer,
  validateOwnership,
} from "@/lib/house/ownership";
import {
  defaultVisibilityForOwnership,
  projectPersonalItemForViewer,
  resolveResourceProjection,
} from "@/lib/house/visibility";
import {
  canChangeCondition,
  canDisposeInventory,
  canTransitionInventoryStatus,
} from "@/lib/house/lifecycle";

const MEMBERS = ["m1", "m2", "m3"] as const;

describe("inventory ownership validation", () => {
  it("accepts household and unknown without owner", () => {
    expect(
      validateOwnership({
        mode: "household",
        ownerMembershipId: null,
        householdMembershipIds: MEMBERS,
      }),
    ).toEqual({ ok: true });
    expect(
      validateOwnership({
        mode: "unknown",
        ownerMembershipId: null,
        householdMembershipIds: MEMBERS,
      }),
    ).toEqual({ ok: true });
  });

  it("requires owner for personal and rejects cross-household owner", () => {
    expect(
      validateOwnership({
        mode: "personal",
        ownerMembershipId: null,
        householdMembershipIds: MEMBERS,
      }).ok,
    ).toBe(false);
    expect(
      validateOwnership({
        mode: "personal",
        ownerMembershipId: "outsider",
        householdMembershipIds: MEMBERS,
      }).ok,
    ).toBe(false);
    expect(
      validateOwnership({
        mode: "personal",
        ownerMembershipId: "m1",
        householdMembershipIds: MEMBERS,
      }),
    ).toEqual({ ok: true });
  });

  it("requires at least two members for shared_selected", () => {
    expect(
      validateOwnership({
        mode: "shared_selected",
        ownerMembershipId: null,
        sharedMembershipIds: ["m1"],
        householdMembershipIds: MEMBERS,
      }).ok,
    ).toBe(false);
    expect(
      validateOwnership({
        mode: "shared_selected",
        ownerMembershipId: null,
        sharedMembershipIds: ["m1", "m2"],
        householdMembershipIds: MEMBERS,
      }),
    ).toEqual({ ok: true });
  });

  it("does not infer ownership from expense payer", () => {
    expect(ownershipFromExpensePayer("m1")).toBeNull();
  });
});

describe("personal and household item visibility", () => {
  it("hides owner_only items from other members and coordinators", () => {
    const mode = resolveResourceProjection({
      visibility: "owner_only",
      ownershipMode: "personal",
      ownerMembershipId: "m1",
      selectedMembershipIds: [],
      viewerMembershipId: "m2",
      isHouseholdCoordinator: true,
    });
    expect(mode).toBe("hidden");
    expect(
      projectPersonalItemForViewer({
        item: { id: "x", notes: "secret" },
        mode,
      }),
    ).toBeNull();
  });

  it("shows household-visible items to any member", () => {
    expect(
      resolveResourceProjection({
        visibility: "household",
        ownershipMode: "household",
        ownerMembershipId: null,
        selectedMembershipIds: [],
        viewerMembershipId: "m2",
        isHouseholdCoordinator: false,
      }),
    ).toBe("full");
  });

  it("defaults personal ownership to owner_only visibility", () => {
    expect(defaultVisibilityForOwnership("personal")).toBe("owner_only");
    expect(defaultVisibilityForOwnership("household")).toBe("household");
  });
});

describe("ownership transfer", () => {
  it("allows owner or coordinator to transfer personal items", () => {
    expect(
      canTransferOwnership({
        actorMembershipId: "m1",
        currentMode: "personal",
        currentOwnerMembershipId: "m1",
        isHouseholdCoordinator: false,
      }),
    ).toBe(true);
    expect(
      canTransferOwnership({
        actorMembershipId: "m2",
        currentMode: "personal",
        currentOwnerMembershipId: "m1",
        isHouseholdCoordinator: false,
      }),
    ).toBe(false);
    expect(
      canTransferOwnership({
        actorMembershipId: "m2",
        currentMode: "personal",
        currentOwnerMembershipId: "m1",
        isHouseholdCoordinator: true,
      }),
    ).toBe(true);
  });
});

describe("condition and location lifecycle", () => {
  it("allows condition transitions and retains history semantics", () => {
    expect(canChangeCondition("good", "damaged")).toBe(true);
    expect(canChangeCondition("damaged", "good")).toBe(true);
    expect(canChangeCondition("new", "new")).toBe(true);
  });

  it("supports dispose from active and blocks from terminal", () => {
    expect(canDisposeInventory("active")).toBe(true);
    expect(canTransitionInventoryStatus("disposed", "active")).toBe(false);
    expect(canTransitionInventoryStatus("active", "moved_out")).toBe(true);
  });
});
