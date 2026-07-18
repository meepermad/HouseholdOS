import type {
  CandidateSource,
  PriorityBand,
  RecConfidence,
  RecModeFilter,
  RecVisibility,
  ShoppingCandidate,
} from "./types";
import { canonicalShoppingKey } from "./normalize";

export function makeCandidate(params: {
  name: string;
  priorityBand: PriorityBand;
  suggestedQuantity?: number | null;
  suggestedUnit?: string;
  quantityBreakdown?: ShoppingCandidate["quantityBreakdown"];
  unitMismatch?: boolean;
  visibility?: RecVisibility;
  ownerMembershipId?: string | null;
  relatedSupplyId?: string | null;
  relatedPantryId?: string | null;
  explanation: string;
  reasonCodes: string[];
  confidence?: RecConfidence;
  existingListItemId?: string | null;
  sources: CandidateSource[];
  modeTags: RecModeFilter[];
}): ShoppingCandidate {
  return {
    name: params.name.trim(),
    normalizedKey: canonicalShoppingKey(params.name),
    priorityBand: params.priorityBand,
    suggestedQuantity: params.suggestedQuantity ?? null,
    suggestedUnit: params.suggestedUnit ?? "item",
    quantityBreakdown: params.quantityBreakdown ?? [],
    unitMismatch: params.unitMismatch ?? false,
    visibility: params.visibility ?? "shared",
    ownerMembershipId: params.ownerMembershipId ?? null,
    relatedSupplyId: params.relatedSupplyId ?? null,
    relatedPantryId: params.relatedPantryId ?? null,
    explanation: params.explanation,
    reasonCodes: params.reasonCodes,
    confidence: params.confidence ?? "medium",
    existingListItemId: params.existingListItemId ?? null,
    sources: params.sources,
    modeTags: params.modeTags,
  };
}

const BAND_RANK: Record<PriorityBand, number> = {
  urgent: 0,
  recommended: 1,
  consider: 2,
};

export function compareCandidates(a: ShoppingCandidate, b: ShoppingCandidate): number {
  const band = BAND_RANK[a.priorityBand] - BAND_RANK[b.priorityBand];
  if (band !== 0) return band;
  return a.name.localeCompare(b.name);
}

export function filterByMode(
  candidates: ShoppingCandidate[],
  mode: RecModeFilter,
): ShoppingCandidate[] {
  if (mode === "everything") return candidates;
  return candidates.filter((c) => c.modeTags.includes(mode));
}
