import { describe, expect, it } from "vitest";
import {
  CERTIFICATION_ISOLATION_DOMAINS,
  TWO_HOUSEHOLD_CERTIFICATION,
} from "../../helpers/two-household-certification";

describe("two-household certification roster", () => {
  it("defines 4×6 households with a dual member", () => {
    expect(TWO_HOUSEHOLD_CERTIFICATION.householdA.memberCount).toBe(4);
    expect(TWO_HOUSEHOLD_CERTIFICATION.householdB.memberCount).toBe(6);
    expect(TWO_HOUSEHOLD_CERTIFICATION.dualHouseholdMemberEmail).toContain("@");
  });

  it("lists isolation domains including offline and export", () => {
    expect(CERTIFICATION_ISOLATION_DOMAINS).toContain("offline_outbox");
    expect(CERTIFICATION_ISOLATION_DOMAINS).toContain("export");
    expect(CERTIFICATION_ISOLATION_DOMAINS).toContain("routed_settlements");
  });
});
