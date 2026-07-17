/** Human-readable labels for household membership roles. */

export type HouseholdRoleKey =
  | "member"
  | "household_coordinator"
  | "financial_coordinator"
  | string;

const ROLE_LABELS: Record<string, string> = {
  member: "Member",
  household_coordinator: "Household coordinator",
  financial_coordinator: "Financial coordinator",
};

export function formatRoleLabel(role: HouseholdRoleKey): string {
  if (ROLE_LABELS[role]) return ROLE_LABELS[role];
  return role
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatRoleList(roles: readonly string[]): string {
  if (roles.length === 0) return "Member";
  return roles.map(formatRoleLabel).join(", ");
}
