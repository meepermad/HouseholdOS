/** Shopping recommendation types — scoring version 1. */

export const SHOPPING_REC_VERSION = "1";

export type PriorityBand = "urgent" | "recommended" | "consider";
export type RecConfidence = "low" | "medium" | "high";
export type RecVisibility = "shared" | "personal" | "selected_members";
export type RecModeFilter =
  | "everything"
  | "planned_meals"
  | "running_low"
  | "run_out_soon"
  | "open_requests"
  | "recurring_staples"
  | "guest_event"
  | "forgotten";

export type CandidateSource = {
  sourceType: string;
  sourceId: string | null;
  reasonCode: string;
  explanation: string;
  quantity: number | null;
  quantityUnit: string | null;
};

export type ShoppingCandidate = {
  name: string;
  normalizedKey: string;
  priorityBand: PriorityBand;
  suggestedQuantity: number | null;
  suggestedUnit: string;
  quantityBreakdown: { label: string; quantity: number | null; unit: string }[];
  unitMismatch: boolean;
  visibility: RecVisibility;
  ownerMembershipId: string | null;
  relatedSupplyId: string | null;
  relatedPantryId: string | null;
  explanation: string;
  reasonCodes: string[];
  confidence: RecConfidence;
  existingListItemId: string | null;
  sources: CandidateSource[];
  modeTags: RecModeFilter[];
};

export type BuiltRecommendationItem = ShoppingCandidate & {
  sortOrder: number;
};

export const MODE_FILTER_LABELS: Record<RecModeFilter, string> = {
  everything: "Everything recommended",
  planned_meals: "Needed for planned meals",
  running_low: "Running low",
  run_out_soon: "Likely to run out soon",
  open_requests: "Open household requests",
  recurring_staples: "Recurring staples",
  guest_event: "Guest and event needs",
  forgotten: "Forgotten items",
};
