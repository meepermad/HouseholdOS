import { describe, expect, it } from "vitest";
import { can, CAPABILITIES } from "@/lib/permissions";

describe("Phase 9 calendar capabilities", () => {
  it("includes new calendar capabilities in the matrix", () => {
    expect(CAPABILITIES).toContain("calendar.invite");
    expect(CAPABILITIES).toContain("calendar.view_availability");
    expect(CAPABILITIES).toContain("calendar.manage_integrations");
    expect(CAPABILITIES).toContain("calendar.manage_household");
    expect(CAPABILITIES).toContain("calendar.manage_resources");
  });

  it("grants members invite/availability/integrations but not household manage", () => {
    expect(can(["member"], "calendar.invite")).toBe(true);
    expect(can(["member"], "calendar.view_availability")).toBe(true);
    expect(can(["member"], "calendar.manage_integrations")).toBe(true);
    expect(can(["member"], "calendar.manage_household")).toBe(false);
    expect(can(["household_coordinator"], "calendar.manage_resources")).toBe(
      true,
    );
  });
});
