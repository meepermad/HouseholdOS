import { describe, expect, it } from "vitest";
import {
  parseHouseholdArchive,
  previewArchiveRestore,
} from "@/lib/export/restore";
import type { HouseholdArchive } from "@/lib/export/build-archive";

const sample: HouseholdArchive = {
  version: "1.0.0",
  exportedAt: "2026-07-17T00:00:00.000Z",
  householdId: "hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh",
  disclaimer: "test",
  household: { name: "Test" },
  members: [],
  expenses: [{ id: "e1" }],
  chores: [{ title: "Trash" }],
  calendar: [{ title: "Dinner", starts_at: "2026-07-18T18:00:00Z" }],
  inventory: [{ name: "Vacuum" }],
  supplies: [{ name: "Paper towels" }],
  pantry: [{ name: "Rice" }],
  shopping: [],
  meals: [],
  recipes: [],
  maintenance: [],
  governance: [],
  polls: [],
  utilities: [{ name: "Electric" }],
};

describe("archive restore helpers", () => {
  it("previews nonfinancial counts and excludes financial domains", () => {
    const preview = previewArchiveRestore(sample);
    expect(preview.counts.inventory).toBe(1);
    expect(preview.counts.chores).toBe(1);
    expect(preview.excluded).toContain("expenses/payments/obligations");
  });

  it("parses wrapped export payload", () => {
    const parsed = parseHouseholdArchive({ archive: sample, csv: {} });
    expect(parsed.householdId).toBe(sample.householdId);
  });
});
