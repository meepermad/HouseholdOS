/**
 * Two-household certification fixture shape (4×6 roster + dual member).
 * Integration tests should seed via authed clients; this documents the roster.
 */

export type CertificationRoster = {
  householdA: { name: string; memberCount: 4 };
  householdB: { name: string; memberCount: 6 };
  dualHouseholdMemberEmail: string;
};

export const TWO_HOUSEHOLD_CERTIFICATION: CertificationRoster = {
  householdA: { name: "Household A (4)", memberCount: 4 },
  householdB: { name: "Household B (6)", memberCount: 6 },
  dualHouseholdMemberEmail: "dual@hos-cert.local",
};

export const CERTIFICATION_ISOLATION_DOMAINS = [
  "home",
  "money",
  "pairwise_balances",
  "routed_settlements",
  "opening_balances",
  "polls",
  "chores",
  "calendar",
  "pantry",
  "supplies",
  "shopping",
  "recommendations",
  "forgotten_favorites",
  "receipts",
  "product_aliases",
  "maintenance",
  "governance",
  "meetings",
  "packages",
  "parking",
  "notifications",
  "offline_outbox",
  "search",
  "export",
  "restore_import",
] as const;
