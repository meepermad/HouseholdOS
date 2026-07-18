import { makeCandidate } from "./candidates";
import { consolidateCandidates, excludeAlreadyOnList } from "./dedupe";
import { canonicalShoppingKey } from "./normalize";
import type {
  BuiltRecommendationItem,
  RecModeFilter,
  ShoppingCandidate,
} from "./types";
import { filterByMode } from "./candidates";
import { compareCandidates } from "./candidates";

export type MealIngredientNeed = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string;
  mealLabel: string;
  mealId: string;
  accepted: boolean;
  soon: boolean;
  guestRelated?: boolean;
};

export type OpenShoppingRequest = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string;
  neededBy: string | null;
  ownership: string;
  ownerMembershipId: string | null;
  relatedSupplyId: string | null;
};

export type SupplyNeed = {
  id: string;
  name: string;
  quantity: number | null;
  reorderThreshold: number | null;
  stockState: string;
  projectedDaysRemaining: number | null;
  purchaseCount: number;
};

export type StapleInterval = {
  id: string;
  name: string;
  relatedSupplyId: string | null;
  typicalIntervalDays: number;
  daysSinceLastPurchase: number;
  lastQuantity: number | null;
  unit: string;
  purchaseCount: number;
};

export type SharedPurchaseNeed = {
  id: string;
  title: string;
  status: string;
};

export type ForgottenNeed = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string;
};

export type BuildShoppingRecommendationsInput = {
  mealIngredients: MealIngredientNeed[];
  openRequests: OpenShoppingRequest[];
  supplies: SupplyNeed[];
  staples: StapleInterval[];
  sharedPurchases: SharedPurchaseNeed[];
  forgotten: ForgottenNeed[];
  openListNormalizedKeys: string[];
  horizonDays: number;
  includeSupplyForecasts: boolean;
  includeRecurringStaples: boolean;
  includeProposedMeals: boolean;
  includeGuestNeeds: boolean;
  forecastConfidence: "low" | "medium" | "high";
  mode: RecModeFilter;
  today?: string;
};

function daysUntil(neededBy: string, today: string): number {
  return Math.round(
    (Date.parse(`${neededBy}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86400000,
  );
}

export function buildShoppingRecommendations(
  input: BuildShoppingRecommendationsInput,
): BuiltRecommendationItem[] {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const candidates: ShoppingCandidate[] = [];

  for (const m of input.mealIngredients) {
    if (m.accepted) {
      candidates.push(
        makeCandidate({
          name: m.name,
          priorityBand: m.soon ? "urgent" : "recommended",
          suggestedQuantity: m.quantity,
          suggestedUnit: m.unit,
          explanation: `Needed for ${m.mealLabel}.`,
          reasonCodes: ["accepted_meal_ingredient"],
          confidence: "high",
          quantityBreakdown: [
            {
              label: m.mealLabel,
              quantity: m.quantity,
              unit: m.unit,
            },
          ],
          sources: [
            {
              sourceType: "meal_plan",
              sourceId: m.mealId,
              reasonCode: "accepted_meal_ingredient",
              explanation: `Needed for ${m.mealLabel}.`,
              quantity: m.quantity,
              quantityUnit: m.unit,
            },
          ],
          modeTags: m.guestRelated
            ? ["planned_meals", "guest_event"]
            : ["planned_meals"],
        }),
      );
    } else if (input.includeProposedMeals) {
      candidates.push(
        makeCandidate({
          name: m.name,
          priorityBand: "recommended",
          suggestedQuantity: m.quantity,
          suggestedUnit: m.unit,
          explanation: `Ingredient for a proposed meal: ${m.mealLabel}.`,
          reasonCodes: ["proposed_meal_ingredient"],
          confidence: "medium",
          sources: [
            {
              sourceType: "meal_plan",
              sourceId: m.mealId,
              reasonCode: "proposed_meal_ingredient",
              explanation: `Ingredient for a proposed meal: ${m.mealLabel}.`,
              quantity: m.quantity,
              quantityUnit: m.unit,
            },
          ],
          modeTags: ["planned_meals"],
        }),
      );
    }
  }

  for (const r of input.openRequests) {
    const deadlineSoon =
      r.neededBy != null && daysUntil(r.neededBy, today) <= 3;
    candidates.push(
      makeCandidate({
        name: r.name,
        priorityBand: deadlineSoon ? "urgent" : "recommended",
        suggestedQuantity: r.quantity,
        suggestedUnit: r.unit,
        visibility:
          r.ownership === "personal" || r.ownership === "temporary"
            ? "personal"
            : "shared",
        ownerMembershipId: r.ownerMembershipId,
        relatedSupplyId: r.relatedSupplyId,
        explanation: deadlineSoon
          ? `Open shopping request with an approaching deadline.`
          : `Open household shopping request.`,
        reasonCodes: ["open_shopping_request"],
        confidence: "high",
        existingListItemId: r.id,
        sources: [
          {
            sourceType: "shopping_list_item",
            sourceId: r.id,
            reasonCode: "open_shopping_request",
            explanation: "Open shopping request.",
            quantity: r.quantity,
            quantityUnit: r.unit,
          },
        ],
        modeTags: ["open_requests"],
      }),
    );
  }

  if (input.includeSupplyForecasts) {
    for (const s of input.supplies) {
      const out = s.stockState === "out" || (s.quantity != null && s.quantity <= 0);
      const below =
        s.reorderThreshold != null &&
        s.quantity != null &&
        s.quantity <= s.reorderThreshold;
      const runoutSoon =
        s.projectedDaysRemaining != null &&
        s.projectedDaysRemaining <= input.horizonDays;

      if (!out && !below && !runoutSoon) continue;

      const lowConfidence =
        input.forecastConfidence === "high" && s.purchaseCount < 3 && runoutSoon && !below && !out;
      if (lowConfidence) continue;

      candidates.push(
        makeCandidate({
          name: s.name,
          priorityBand: out ? "urgent" : below || runoutSoon ? "recommended" : "consider",
          relatedSupplyId: s.id,
          explanation: out
            ? "Currently marked out."
            : runoutSoon && s.projectedDaysRemaining != null
              ? `Projected to run out in about ${s.projectedDaysRemaining} days.`
              : "Below the household restock threshold.",
          reasonCodes: out
            ? ["supply_out"]
            : runoutSoon
              ? ["supply_runout_forecast"]
              : ["supply_below_threshold"],
          confidence:
            s.purchaseCount >= 3 ? "high" : s.purchaseCount >= 1 ? "medium" : "low",
          sources: [
            {
              sourceType: "supply_item",
              sourceId: s.id,
              reasonCode: out
                ? "supply_out"
                : runoutSoon
                  ? "supply_runout_forecast"
                  : "supply_below_threshold",
              explanation: "Supply restock signal.",
              quantity: null,
              quantityUnit: null,
            },
          ],
          modeTags: runoutSoon
            ? ["running_low", "run_out_soon"]
            : ["running_low"],
        }),
      );
    }
  }

  if (input.includeRecurringStaples) {
    for (const st of input.staples) {
      if (st.daysSinceLastPurchase < st.typicalIntervalDays) continue;
      if (st.purchaseCount < 2) continue;
      candidates.push(
        makeCandidate({
          name: st.name,
          priorityBand: "consider",
          suggestedQuantity: st.lastQuantity,
          suggestedUnit: st.unit,
          relatedSupplyId: st.relatedSupplyId,
          explanation: `Usually purchased every ${st.typicalIntervalDays} weeks-equivalent days and last purchased ${st.daysSinceLastPurchase} days ago.`,
          reasonCodes: ["recurring_staple"],
          confidence: st.purchaseCount >= 3 ? "medium" : "low",
          sources: [
            {
              sourceType: "purchase_history",
              sourceId: st.id,
              reasonCode: "recurring_staple",
              explanation: "Recurring staple interval.",
              quantity: st.lastQuantity,
              quantityUnit: st.unit,
            },
          ],
          modeTags: ["recurring_staples"],
        }),
      );
    }
  }

  for (const p of input.sharedPurchases) {
    if (p.status !== "approved" && p.status !== "proposed") continue;
    candidates.push(
      makeCandidate({
        name: p.title,
        priorityBand: p.status === "approved" ? "consider" : "consider",
        explanation:
          p.status === "approved"
            ? "Approved shared purchase without a purchaser yet."
            : "Shared purchase proposal awaiting progress.",
        reasonCodes: ["shared_purchase"],
        confidence: "medium",
        sources: [
          {
            sourceType: "shared_purchase_proposal",
            sourceId: p.id,
            reasonCode: "shared_purchase",
            explanation: "Shared purchase proposal.",
            quantity: null,
            quantityUnit: null,
          },
        ],
        modeTags: ["everything"],
      }),
    );
  }

  for (const f of input.forgotten) {
    candidates.push(
      makeCandidate({
        name: f.name,
        priorityBand: "recommended",
        suggestedQuantity: f.quantity,
        suggestedUnit: f.unit,
        explanation: "Still needed from a previous shopping trip.",
        reasonCodes: ["forgotten_item"],
        confidence: "high",
        sources: [
          {
            sourceType: "shopping_trip_event",
            sourceId: f.id,
            reasonCode: "forgotten_item",
            explanation: "Left incomplete on a prior trip.",
            quantity: f.quantity,
            quantityUnit: f.unit,
          },
        ],
        modeTags: ["forgotten"],
      }),
    );
  }

  if (input.includeGuestNeeds) {
    // Guest needs arrive via mealIngredients.guestRelated tags already.
  }

  const openKeys = new Set(
    input.openListNormalizedKeys.map((k) => canonicalShoppingKey(k)),
  );
  // Open requests already on the list: keep only as informational via existingListItemId filter
  const withoutDupOpen = candidates.filter((c) => {
    if (c.reasonCodes.includes("open_shopping_request")) return false;
    return true;
  });

  const consolidated = consolidateCandidates(withoutDupOpen);
  const filtered = excludeAlreadyOnList(consolidated, openKeys);
  const modeFiltered = filterByMode(filtered, input.mode).sort(compareCandidates);

  return modeFiltered.map((c, i) => ({ ...c, sortOrder: i }));
}
