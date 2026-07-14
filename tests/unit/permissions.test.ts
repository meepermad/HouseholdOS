import { describe, expect, it } from "vitest";
import {
  can,
  canChangeRole,
  canRemoveMember,
} from "@/lib/permissions";
import { createHouseholdSchema, inviteMemberSchema } from "@/lib/validations/household";

describe("permissions", () => {
  it("allows owners to archive and transfer, not leave", () => {
    expect(can("owner", "household.archive")).toBe(true);
    expect(can("owner", "member.transfer_ownership")).toBe(true);
    expect(can("owner", "member.leave")).toBe(false);
  });

  it("restricts admin role changes around owners", () => {
    expect(
      canChangeRole({
        actorRole: "admin",
        targetCurrentRole: "member",
        targetNextRole: "admin",
        actorIsTarget: false,
      }),
    ).toBe(true);
    expect(
      canChangeRole({
        actorRole: "admin",
        targetCurrentRole: "owner",
        targetNextRole: "member",
        actorIsTarget: false,
      }),
    ).toBe(false);
  });

  it("prevents removing owners", () => {
    expect(
      canRemoveMember({
        actorRole: "owner",
        targetRole: "owner",
        actorIsTarget: false,
      }),
    ).toBe(false);
  });
});

describe("zod household schemas", () => {
  it("accepts valid create payload", () => {
    const result = createHouseholdSchema.safeParse({ name: "Oak Street" });
    expect(result.success).toBe(true);
  });

  it("rejects owner invites", () => {
    const result = inviteMemberSchema.safeParse({
      householdId: "11111111-1111-1111-1111-111111111111",
      email: "a@example.com",
      role: "owner",
    });
    expect(result.success).toBe(false);
  });
});
