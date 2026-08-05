/**
 * Honest maturity labels for shipped-but-incomplete surfaces.
 *
 * Rules:
 * - A surface that cannot do what its name implies must say so where people
 *   enter it. Silence reads as "finished".
 * - `unavailable` means the UI must hide or disable the control, not just warn.
 * - Promote to `stable` in the same change that finishes the feature.
 *
 * This module is environment-agnostic (no server-only imports) so nav config,
 * server components, and tests can share it. Database-dependent gating lives in
 * `@/lib/launch/feature-readiness`.
 */

export type FeatureMaturity = "stable" | "beta" | "preview" | "unavailable";

export type FeatureMaturityKey =
  | "googleCalendarSync"
  | "notificationDigest"
  | "productLookup"
  | "roommateOps"
  | "householdSearch";

export type FeatureMaturityInfo = {
  status: FeatureMaturity;
  /** Plain-language limit, written for a household member. */
  note: string;
};

const MATURITY_LABELS: Record<FeatureMaturity, string | null> = {
  stable: null,
  beta: "Beta",
  preview: "Preview",
  unavailable: "Not available",
};

export const FEATURE_MATURITY: Record<FeatureMaturityKey, FeatureMaturityInfo> =
  {
    googleCalendarSync: {
      // Not even usable in production, so it is weaker than beta.
      status: "preview",
      note: "Google OAuth and provider sync are development scaffolding. Connect is disabled in production, and a mock connection is not a real sync.",
    },
    notificationDigest: {
      status: "unavailable",
      note: "Daily digest batching exists as scheduling math only. Delivery is not wired, so digest choices are hidden and alerts stay immediate.",
    },
    productLookup: {
      status: "beta",
      note: "Barcode lookup only. Results are not saved to inventory, pantry, or shopping lists yet.",
    },
    roommateOps: {
      status: "beta",
      note: "Shared purchases, packages, and directory work; supply forecasts are approximate and meeting notes overlap with Meetings.",
    },
    householdSearch: {
      status: "beta",
      note: "Covers chores, calendar, expenses, inventory, supplies, maintenance, governance, and responsibilities. Meals, recipes, and shopping are not indexed.",
    },
  };

/** Chip text for a status; `null` when nothing should be shown. */
export function maturityLabel(status: FeatureMaturity): string | null {
  return MATURITY_LABELS[status];
}

export function featureMaturity(key: FeatureMaturityKey): FeatureMaturityInfo {
  return FEATURE_MATURITY[key];
}

/** True when the surface must be hidden or disabled rather than merely labeled. */
export function isFeatureUsable(key: FeatureMaturityKey): boolean {
  return FEATURE_MATURITY[key].status !== "unavailable";
}
