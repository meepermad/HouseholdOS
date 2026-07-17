import "server-only";

import type { HouseholdArchive } from "@/lib/export/build-archive";

export type RestorePreview = {
  version: string;
  sourceHouseholdId: string;
  counts: {
    inventory: number;
    supplies: number;
    pantry: number;
    shopping: number;
    chores: number;
    calendar: number;
    utilities: number;
    polls: number;
  };
  excluded: string[];
};

export function previewArchiveRestore(archive: HouseholdArchive): RestorePreview {
  return {
    version: archive.version,
    sourceHouseholdId: archive.householdId,
    counts: {
      inventory: archive.inventory?.length ?? 0,
      supplies: archive.supplies?.length ?? 0,
      pantry: archive.pantry?.length ?? 0,
      shopping: archive.shopping?.length ?? 0,
      chores: archive.chores?.length ?? 0,
      calendar: archive.calendar?.length ?? 0,
      utilities: archive.utilities?.length ?? 0,
      polls: archive.polls?.length ?? 0,
    },
    excluded: [
      "members/auth",
      "expenses/payments/obligations",
      "push endpoints",
      "feed tokens",
      "secrets",
      "governance financial acknowledgments",
    ],
  };
}

export function parseHouseholdArchive(raw: unknown): HouseholdArchive {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid archive JSON");
  }
  const obj = raw as Record<string, unknown>;
  const archive = (obj.archive as HouseholdArchive | undefined) ?? (raw as HouseholdArchive);
  if (!archive || archive.version !== "1.0.0" || !archive.householdId) {
    throw new Error("Unsupported or incomplete HouseholdOS archive");
  }
  return archive;
}

export type RestoreDomain =
  | "inventory"
  | "supplies"
  | "pantry"
  | "shopping"
  | "chores"
  | "calendar"
  | "utilities";

export function rowsForDomain(
  archive: HouseholdArchive,
  domain: RestoreDomain,
): Array<Record<string, unknown>> {
  switch (domain) {
    case "inventory":
      return archive.inventory ?? [];
    case "supplies":
      return archive.supplies ?? [];
    case "pantry":
      return archive.pantry ?? [];
    case "shopping":
      return archive.shopping ?? [];
    case "chores":
      return archive.chores ?? [];
    case "calendar":
      return archive.calendar ?? [];
    case "utilities":
      return archive.utilities ?? [];
  }
}
