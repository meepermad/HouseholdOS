import "server-only";

import {
  assertNoPushOrFeedSecrets,
  filterPantryForExport,
  filterRecipesForExport,
  stripSecretFields,
  type ExportPrivacyContext,
} from "./privacy-filter";
import { rowsToCsv } from "@/lib/import/csv";

export type HouseholdArchive = {
  version: "1.0.0";
  exportedAt: string;
  householdId: string;
  disclaimer: string;
  household: Record<string, unknown>;
  members: Array<Record<string, unknown>>;
  expenses: Array<Record<string, unknown>>;
  chores: Array<Record<string, unknown>>;
  calendar: Array<Record<string, unknown>>;
  inventory: Array<Record<string, unknown>>;
  supplies: Array<Record<string, unknown>>;
  pantry: Array<Record<string, unknown>>;
  shopping: Array<Record<string, unknown>>;
  meals: Array<Record<string, unknown>>;
  recipes: Array<Record<string, unknown>>;
  maintenance: Array<Record<string, unknown>>;
  governance: Array<Record<string, unknown>>;
  polls: Array<Record<string, unknown>>;
  utilities: Array<Record<string, unknown>>;
};

const DISCLAIMER =
  "HouseholdOS backup/export archive. Not a full database restore.";

export function buildHouseholdArchive(input: {
  householdId: string;
  household: Record<string, unknown>;
  members: Array<Record<string, unknown>>;
  expenses: Array<Record<string, unknown>>;
  chores: Array<Record<string, unknown>>;
  calendar: Array<Record<string, unknown>>;
  inventory: Array<Record<string, unknown>>;
  supplies: Array<Record<string, unknown>>;
  pantry: Array<Record<string, unknown>>;
  shopping: Array<Record<string, unknown>>;
  meals: Array<Record<string, unknown>>;
  recipes: Array<Record<string, unknown>>;
  maintenance: Array<Record<string, unknown>>;
  governance: Array<Record<string, unknown>>;
  polls: Array<Record<string, unknown>>;
  utilities: Array<Record<string, unknown>>;
  privacy: ExportPrivacyContext;
}): HouseholdArchive {
  const archive: HouseholdArchive = {
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    householdId: input.householdId,
    disclaimer: DISCLAIMER,
    household: stripSecretFields(input.household) as Record<string, unknown>,
    members: input.members.map((m) => stripSecretFields(m) as Record<string, unknown>),
    expenses: input.expenses.map((e) => stripSecretFields(e) as Record<string, unknown>),
    chores: input.chores.map((c) => stripSecretFields(c) as Record<string, unknown>),
    calendar: input.calendar.map((c) => stripSecretFields(c) as Record<string, unknown>),
    inventory: input.inventory.map((i) => stripSecretFields(i) as Record<string, unknown>),
    supplies: input.supplies.map((s) => stripSecretFields(s) as Record<string, unknown>),
    pantry: filterPantryForExport(input.pantry, input.privacy),
    shopping: input.shopping.map((s) => stripSecretFields(s) as Record<string, unknown>),
    meals: input.meals.map((m) => stripSecretFields(m) as Record<string, unknown>),
    recipes: filterRecipesForExport(input.recipes, input.privacy),
    maintenance: input.maintenance.map((m) => stripSecretFields(m) as Record<string, unknown>),
    governance: input.governance.map((g) => stripSecretFields(g) as Record<string, unknown>),
    polls: input.polls.map((p) => stripSecretFields(p) as Record<string, unknown>),
    utilities: input.utilities.map((u) => stripSecretFields(u) as Record<string, unknown>),
  };

  const violations = assertNoPushOrFeedSecrets(archive);
  if (violations.length > 0) {
    throw new Error(`Export privacy filter failed: ${violations.join(", ")}`);
  }
  return archive;
}

export function archiveTableToCsv(
  rows: Array<Record<string, unknown>>,
): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const body = rows.map((row) =>
    headers.map((h) => {
      const v = row[h];
      if (v === null || v === undefined) return "";
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    }),
  );
  return rowsToCsv(headers, body);
}
