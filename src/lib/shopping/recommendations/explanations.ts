/**
 * Privacy-safe shopping recommendation source explanations.
 * Never includes private recipe names, personal pantry qty, or preference authors.
 */

import type { CandidateSource } from "@/lib/shopping/recommendations/types";

const SAFE_REASON_TEMPLATES: Record<string, (ctx: SourceExplainContext) => string> = {
  accepted_meal_ingredient: (c) =>
    c.mealLabel ? `Needed for ${c.mealLabel}.` : "Needed for a planned meal.",
  proposed_meal_ingredient: (c) =>
    c.mealLabel
      ? `Ingredient for a proposed meal: ${c.mealLabel}.`
      : "Ingredient for a proposed meal.",
  open_shopping_request: () => "Open household shopping request.",
  supply_out: () => "Currently marked out.",
  supply_below_threshold: () => "Below the household restock threshold.",
  supply_runout_forecast: (c) =>
    c.projectedDays != null
      ? `Projected to run out in about ${c.projectedDays} days.`
      : "Projected to run out before the next shopping horizon.",
  recurring_staple: (c) =>
    c.stapleExplanation ?? "Recurring household staple approaching its usual purchase interval.",
  forgotten_item: () => "Still needed from a previous shopping trip.",
  guest_need: (c) =>
    c.mealLabel
      ? `Requested for ${c.mealLabel} (guest event).`
      : "Needed for an upcoming guest event.",
  shared_purchase: () => "Approved shared-purchase proposal without a purchaser.",
  meal_prep: (c) =>
    c.mealLabel
      ? `Needed for meal prep: ${c.mealLabel}.`
      : "Needed for an upcoming meal-prep session.",
};

export type SourceExplainContext = {
  mealLabel?: string | null;
  projectedDays?: number | null;
  stapleExplanation?: string | null;
  /** When false, omit meal-linked explanations that might leak private recipes */
  mealLabelSafe?: boolean;
};

export function explainReasonCode(
  reasonCode: string,
  ctx: SourceExplainContext = {},
): string {
  const mealSafe = ctx.mealLabelSafe !== false;
  const safeCtx =
    mealSafe
      ? ctx
      : { ...ctx, mealLabel: null };
  const fn = SAFE_REASON_TEMPLATES[reasonCode];
  if (fn) return fn(safeCtx);
  return "Recommended based on household shopping signals.";
}

export function mergeSourceExplanations(
  sources: readonly CandidateSource[],
  max = 3,
): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const s of sources) {
    const text = (s.explanation || "").trim();
    if (!text || seen.has(text)) continue;
    // Strip anything that looks like a private identity
    if (/\b(membership_|user_|owner_only|creator_only)\b/i.test(text)) continue;
    seen.add(text);
    parts.push(text);
    if (parts.length >= max) break;
  }
  return parts.join(" ");
}

export function sanitizeMealLabel(label: string | null | undefined): string {
  const t = (label ?? "").trim();
  if (!t) return "planned meal";
  // Avoid leaking raw recipe titles from creator-only contexts — callers should
  // pass a generic label when recipe is not household-visible.
  return t.slice(0, 80);
}
