import { describe, expect, it } from "vitest";
import {
  can,
  canChangeRoles,
  normalizeRoles,
} from "@/lib/permissions";

describe("permissions", () => {
  it("grants invite only to household coordinators", () => {
    expect(can(["member"], "member.invite")).toBe(false);
    expect(can(["member", "household_coordinator"], "member.invite")).toBe(true);
  });

  it("prevents self role changes", () => {
    expect(
      canChangeRoles({
        actorRoles: ["member", "household_coordinator"],
        actorIsTarget: true,
        nextRoles: ["member", "household_coordinator", "financial_coordinator"],
      }),
    ).toBe(false);
  });

  it("allows coordinator to change another member roles", () => {
    expect(
      canChangeRoles({
        actorRoles: ["member", "household_coordinator"],
        actorIsTarget: false,
        nextRoles: ["member", "financial_coordinator"],
      }),
    ).toBe(true);
  });

  it("normalizes roles to always include member", () => {
    expect(normalizeRoles(["financial_coordinator"])).toEqual([
      "member",
      "financial_coordinator",
    ]);
  });

  it("grants expense capabilities to every active role", () => {
    expect(can(["member"], "expense.create")).toBe(true);
    expect(can(["financial_coordinator"], "expense.void")).toBe(true);
  });
});
