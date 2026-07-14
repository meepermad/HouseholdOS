import { describe, expect, it } from "vitest";
import {
  canTransitionMembership,
  isActiveMembership,
  losesHouseholdAccess,
} from "@/lib/membership";
import {
  safeRedirectPath,
  validateCurrentHouseholdSelection,
} from "@/lib/navigation";

describe("membership transitions", () => {
  it("allows active → removed", () => {
    expect(canTransitionMembership("active", "removed")).toBe(true);
  });

  it("disallows removed → active without re-invite path", () => {
    expect(canTransitionMembership("removed", "active")).toBe(false);
  });

  it("marks former/removed as losing access", () => {
    expect(losesHouseholdAccess("former")).toBe(true);
    expect(losesHouseholdAccess("removed")).toBe(true);
    expect(isActiveMembership("active")).toBe(true);
  });
});

describe("navigation safety", () => {
  it("rejects external redirects", () => {
    expect(safeRedirectPath("https://evil.example")).toBe("/app");
    expect(safeRedirectPath("//evil.example")).toBe("/app");
    expect(safeRedirectPath("/app/ok")).toBe("/app/ok");
  });

  it("validates current household against authorized set", () => {
    const a = "11111111-1111-4111-8111-111111111111";
    const b = "22222222-2222-4222-8222-222222222222";
    expect(
      validateCurrentHouseholdSelection({
        requestedId: a,
        authorizedHouseholdIds: [a, b],
      }),
    ).toBe(a);
    expect(
      validateCurrentHouseholdSelection({
        requestedId: a,
        authorizedHouseholdIds: [b],
      }),
    ).toBeNull();
  });
});
