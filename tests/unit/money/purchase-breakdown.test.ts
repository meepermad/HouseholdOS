import { describe, expect, it } from "vitest";
import {
  allocatedRowsToBreakdown,
  formatTaggedPeople,
} from "@/lib/money/purchase-breakdown";

describe("formatTaggedPeople", () => {
  it("names one person, two people, and a group", () => {
    expect(formatTaggedPeople({ names: ["Alex"] })).toBe("Alex");
    expect(formatTaggedPeople({ names: ["Alex", "Sam"] })).toBe("Alex and Sam");
    expect(formatTaggedPeople({ names: ["Alex", "Sam", "Jo"] })).toBe(
      "Alex, Sam, and Jo",
    );
  });

  it("uses roommate-facing fallbacks", () => {
    expect(formatTaggedPeople({ names: [], everyone: true })).toBe("Everyone");
    expect(formatTaggedPeople({ names: [], excluded: true })).toBe(
      "Not reimbursed",
    );
    expect(formatTaggedPeople({ names: [] })).toBe("Unassigned");
  });
});

describe("allocatedRowsToBreakdown", () => {
  it("keeps item names with tagged people and shares", () => {
    const rows = allocatedRowsToBreakdown(
      [
        {
          id: "i1",
          name: "Milk",
          totalCents: 400,
          allocationMode: "personal",
          personalMembershipId: "a",
          allocations: [{ membership_id: "a", amount_cents: 400 }],
        },
        {
          id: "i2",
          name: "Bread",
          totalCents: 600,
          allocationMode: "equal_selected",
          allocations: [
            { membership_id: "a", amount_cents: 300 },
            { membership_id: "b", amount_cents: 300 },
          ],
        },
      ],
      (id) => (id === "a" ? "Alex" : "Sam"),
    );

    expect(rows[0]).toMatchObject({
      name: "Milk",
      tagged: "Alex",
      shares: [{ name: "Alex", amountCents: 400 }],
    });
    expect(rows[1]).toMatchObject({
      name: "Bread",
      tagged: "Alex and Sam",
      shares: [
        { name: "Alex", amountCents: 300 },
        { name: "Sam", amountCents: 300 },
      ],
    });
  });
});
