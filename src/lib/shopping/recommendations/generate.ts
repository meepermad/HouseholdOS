import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  buildShoppingRecommendations,
  type BuildShoppingRecommendationsInput,
} from "@/lib/shopping/recommendations/build";
import { canonicalShoppingKey } from "@/lib/shopping/recommendations/normalize";
import { sanitizeMealLabel } from "@/lib/shopping/recommendations/explanations";
import { SHOPPING_REC_VERSION } from "@/lib/shopping/recommendations/types";
import type { RecModeFilter } from "@/lib/shopping/recommendations/types";
import {
  confidenceMeetsThreshold,
  FORECAST_FORMULA_VERSION,
  projectRunout,
  type StockEventSample,
} from "@/lib/shopping/forecast";
import { buildRecurringStapleCandidates } from "@/lib/shopping/staples";
import { OPEN_SHOPPING_STATUSES } from "@/lib/house/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Untyped = any;

const MEAL_STATUSES = ["planned", "shopping_needed", "ready", "preparing"] as const;

export type GenerateShoppingRecommendationsResult = {
  runId: string;
  itemCount: number;
  fetchedAt: string;
  queryCount: number;
  emptyReasons: string[];
  forecastFormulaVersion: string;
};

/**
 * Gather shopping recommendations with a bounded fixed query set (no per-plan N+1).
 */
export async function generateShoppingRecommendations(params: {
  householdId: string;
  membershipId: string;
  listId: string;
  mode?: RecModeFilter;
}): Promise<GenerateShoppingRecommendationsResult> {
  const supabase = (await createClient()) as Untyped;
  let queryCount = 0;
  const track = async <T>(p: PromiseLike<T>): Promise<T> => {
    queryCount += 1;
    return await p;
  };

  await track(
    supabase.rpc("ensure_shopping_recommendation_preferences", {
      p_household_id: params.householdId,
    }) as PromiseLike<unknown>,
  );

  const prefsRes = await track(
    supabase
      .from("shopping_recommendation_preferences")
      .select("*")
      .eq("household_id", params.householdId)
      .maybeSingle() as PromiseLike<{ data: Record<string, unknown> | null }>,
  );
  const prefs = prefsRes.data;

  const horizonDays = (prefs?.recommendation_horizon_days as number) ?? 10;
  const mode = params.mode ?? "everything";
  const minStapleCount = (prefs?.min_staple_purchase_count as number) ?? 3;
  const forecastThreshold =
    (prefs?.forecast_confidence_threshold as "low" | "medium" | "high") ??
    "medium";
  const emptyReasons: string[] = [];

  const horizonStart = new Date();
  horizonStart.setDate(horizonStart.getDate() - 1);
  const horizonEnd = new Date();
  horizonEnd.setDate(horizonEnd.getDate() + Math.max(horizonDays, 14));

  const [
    listItems,
    supplies,
    mealPlans,
    sharedPurchases,
    stillNeeded,
    suppressions,
  ] = await Promise.all([
    track(
      supabase
        .from("shopping_list_items")
        .select(
          "id,name,quantity,quantity_unit,status,needed_by,intended_ownership,intended_owner_membership_id,related_supply_id",
        )
        .eq("household_id", params.householdId)
        .eq("list_id", params.listId)
        .in("status", [...OPEN_SHOPPING_STATUSES]) as PromiseLike<{
        data: Array<Record<string, unknown>> | null;
      }>,
    ),
    track(
      supabase
        .from("supply_items")
        .select(
          "id,name,quantity,quantity_unit,reorder_threshold,target_quantity,stock_state,ownership_mode,active,last_purchased_at,last_restocked_at",
        )
        .eq("household_id", params.householdId)
        .eq("active", true)
        .limit(80) as PromiseLike<{ data: Array<Record<string, unknown>> | null }>,
    ),
    track(
      supabase
        .from("meal_plans")
        .select(
          "id,custom_meal_name,status,meal_date,guest_count,recipe_id,visibility",
        )
        .eq("household_id", params.householdId)
        .in("status", [...MEAL_STATUSES])
        .gte("meal_date", horizonStart.toISOString().slice(0, 10))
        .lte("meal_date", horizonEnd.toISOString().slice(0, 10))
        .limit(20) as PromiseLike<{ data: Array<Record<string, unknown>> | null }>,
    ),
    track(
      supabase
        .from("shared_purchase_proposals")
        .select("id,title,status")
        .eq("household_id", params.householdId)
        .in("status", ["proposed", "approved"])
        .limit(20) as PromiseLike<{ data: Array<Record<string, unknown>> | null }>,
    ),
    track(
      supabase
        .from("shopping_trip_events")
        .select("id,shopping_item_id,event_type,created_at")
        .eq("household_id", params.householdId)
        .eq("event_type", "still_needed")
        .order("created_at", { ascending: false })
        .limit(40) as PromiseLike<{ data: Array<Record<string, unknown>> | null }>,
    ),
    track(
      supabase
        .from("shopping_staple_suppressions")
        .select("normalized_key,related_supply_id")
        .eq("household_id", params.householdId)
        .limit(100) as PromiseLike<{ data: Array<Record<string, unknown>> | null }>,
    ),
  ]);

  const openRows = (listItems.data ?? []) as Array<Record<string, unknown>>;
  const openKeys = openRows.map((r) => canonicalShoppingKey(String(r.name)));
  const supplyRows = (supplies.data ?? []) as Array<Record<string, unknown>>;
  const supplyIds = supplyRows.map((s) => String(s.id));
  const suppressedKeys = new Set(
    ((suppressions.data ?? []) as Array<Record<string, unknown>>).map((s) =>
      String(s.normalized_key),
    ),
  );
  const suppressedSupplyIds = new Set(
    ((suppressions.data ?? []) as Array<Record<string, unknown>>)
      .map((s) => s.related_supply_id)
      .filter(Boolean)
      .map(String),
  );

  // Batched meal ingredients (no per-plan loop)
  const plans = (mealPlans.data ?? []) as Array<Record<string, unknown>>;
  const planIds = plans.map((p) => String(p.id));
  const planById = new Map(plans.map((p) => [String(p.id), p]));

  const { data: ingredientRows } = planIds.length
    ? await track(
        supabase
          .from("meal_plan_ingredients")
          .select(
            "id,meal_plan_id,display_name,scaled_quantity,required_quantity,quantity_unit,required,checklist_status",
          )
          .eq("household_id", params.householdId)
          .in("meal_plan_id", planIds)
          .eq("required", true)
          .in("checklist_status", ["needed", "on_shopping_list"])
          .limit(400) as PromiseLike<{
          data: Array<Record<string, unknown>> | null;
        }>,
      )
    : { data: [] as Array<Record<string, unknown>> };

  // Recipe visibility for safe meal labels
  const recipeIds = [
    ...new Set(
      plans
        .map((p) => p.recipe_id)
        .filter(Boolean)
        .map(String),
    ),
  ];
  const { data: recipeRows } = recipeIds.length
    ? await track(
        supabase
          .from("recipes")
          .select("id,name,visibility,archived_at,created_by_membership_id")
          .eq("household_id", params.householdId)
          .in("id", recipeIds) as PromiseLike<{
          data: Array<Record<string, unknown>> | null;
        }>,
      )
    : { data: [] as Array<Record<string, unknown>> };
  const recipeById = new Map(
    ((recipeRows ?? []) as Array<Record<string, unknown>>).map((r) => [
      String(r.id),
      r,
    ]),
  );

  const mealIngredientNeeds: BuildShoppingRecommendationsInput["mealIngredients"] =
    [];
  for (const ing of (ingredientRows ?? []) as Array<Record<string, unknown>>) {
    const plan = planById.get(String(ing.meal_plan_id));
    if (!plan) continue;
    const recipe = plan.recipe_id
      ? recipeById.get(String(plan.recipe_id))
      : null;
    // Creator-only recipes: omit from shared recommendations entirely
    if (recipe && String(recipe.visibility) === "creator_only") {
      if (String(recipe.created_by_membership_id) !== params.membershipId) {
        continue;
      }
    }
    if (recipe?.archived_at) continue;

    const scheduled = plan.meal_date
      ? String(plan.meal_date).slice(0, 10)
      : null;
    const soon =
      scheduled != null &&
      Date.parse(`${scheduled}T00:00:00Z`) - Date.now() < 3 * 86400000;

    let mealLabel = sanitizeMealLabel(
      plan.custom_meal_name ? String(plan.custom_meal_name) : null,
    );
    if (
      mealLabel === "planned meal" &&
      recipe &&
      String(recipe.visibility) === "household"
    ) {
      mealLabel = sanitizeMealLabel(String(recipe.name));
    } else if (mealLabel === "planned meal" && scheduled) {
      mealLabel = `meal on ${scheduled}`;
    }

    mealIngredientNeeds.push({
      id: String(ing.id),
      name: String(ing.display_name),
      quantity:
        ing.scaled_quantity != null
          ? Number(ing.scaled_quantity)
          : ing.required_quantity != null
            ? Number(ing.required_quantity)
            : null,
      unit: String(ing.quantity_unit ?? "item"),
      mealLabel,
      mealId: String(plan.id),
      accepted: true,
      soon,
      guestRelated: Number(plan.guest_count ?? 0) > 0,
    });
  }

  // Batched forgotten items
  const stillEvents = (stillNeeded.data ?? []) as Array<Record<string, unknown>>;
  const forgottenItemIds = [
    ...new Set(
      stillEvents
        .map((e) => e.shopping_item_id)
        .filter(Boolean)
        .map(String),
    ),
  ];
  const { data: forgottenItems } = forgottenItemIds.length
    ? await track(
        supabase
          .from("shopping_list_items")
          .select("id,name,quantity,quantity_unit,status")
          .eq("household_id", params.householdId)
          .in("id", forgottenItemIds) as PromiseLike<{
          data: Array<Record<string, unknown>> | null;
        }>,
      )
    : { data: [] as Array<Record<string, unknown>> };
  const forgottenById = new Map(
    ((forgottenItems ?? []) as Array<Record<string, unknown>>).map((i) => [
      String(i.id),
      i,
    ]),
  );
  const forgotten: BuildShoppingRecommendationsInput["forgotten"] = [];
  for (const ev of stillEvents) {
    const item = forgottenById.get(String(ev.shopping_item_id));
    if (!item) continue;
    if (["purchased", "cancelled"].includes(String(item.status))) continue;
    forgotten.push({
      id: String(ev.id),
      name: String(item.name),
      quantity: item.quantity != null ? Number(item.quantity) : null,
      unit: String(item.quantity_unit ?? "item"),
    });
  }

  // Batched stock events for forecast + staples
  const { data: stockEvents } = supplyIds.length
    ? await track(
        supabase
          .from("supply_stock_events")
          .select(
            "supply_item_id,event_type,previous_quantity,new_quantity,created_at",
          )
          .eq("household_id", params.householdId)
          .in("supply_item_id", supplyIds)
          .gte(
            "created_at",
            new Date(Date.now() - 180 * 86400000).toISOString(),
          )
          .order("created_at", { ascending: true })
          .limit(800) as PromiseLike<{
          data: Array<Record<string, unknown>> | null;
        }>,
      )
    : { data: [] as Array<Record<string, unknown>> };

  const eventsBySupply = new Map<string, StockEventSample[]>();
  const restocksBySupply = new Map<
    string,
    Array<{ at: string; quantity: number | null }>
  >();
  for (const ev of (stockEvents ?? []) as Array<Record<string, unknown>>) {
    const sid = String(ev.supply_item_id);
    const sample: StockEventSample = {
      eventType: String(ev.event_type),
      previousQuantity:
        ev.previous_quantity != null ? Number(ev.previous_quantity) : null,
      newQuantity: ev.new_quantity != null ? Number(ev.new_quantity) : null,
      createdAt: String(ev.created_at),
    };
    const list = eventsBySupply.get(sid) ?? [];
    list.push(sample);
    eventsBySupply.set(sid, list);
    if (String(ev.event_type) === "restocked") {
      const rs = restocksBySupply.get(sid) ?? [];
      rs.push({
        at: String(ev.created_at),
        quantity: ev.new_quantity != null ? Number(ev.new_quantity) : null,
      });
      restocksBySupply.set(sid, rs);
    }
  }

  const supplyNeeds: BuildShoppingRecommendationsInput["supplies"] = [];
  for (const s of supplyRows) {
    if (String(s.ownership_mode) === "personal") continue;
    const forecast = projectRunout({
      supplyId: String(s.id),
      name: String(s.name),
      currentQuantity: s.quantity != null ? Number(s.quantity) : null,
      quantityUnit: String(s.quantity_unit ?? "item"),
      reorderThreshold:
        s.reorder_threshold != null ? Number(s.reorder_threshold) : null,
      targetQuantity:
        s.target_quantity != null ? Number(s.target_quantity) : null,
      stockState: String(s.stock_state ?? "unknown"),
      events: eventsBySupply.get(String(s.id)) ?? [],
      eventUnitsConsistent: true,
    });

    const runoutUsable =
      forecast.projectedDaysRemaining != null &&
      confidenceMeetsThreshold(forecast.confidence, forecastThreshold);

    supplyNeeds.push({
      id: String(s.id),
      name: String(s.name),
      quantity: s.quantity != null ? Number(s.quantity) : null,
      reorderThreshold:
        s.reorder_threshold != null ? Number(s.reorder_threshold) : null,
      stockState: String(s.stock_state ?? "unknown"),
      projectedDaysRemaining: runoutUsable
        ? forecast.projectedDaysRemaining
        : null,
      purchaseCount: forecast.purchaseOrRestockCount,
    });
  }

  const stapleInputs = supplyRows.map((s) => ({
    supplyId: String(s.id),
    name: String(s.name),
    unit: String(s.quantity_unit ?? "item"),
    restocks: restocksBySupply.get(String(s.id)) ?? [],
    suppressed:
      suppressedKeys.has(canonicalShoppingKey(String(s.name))) ||
      suppressedSupplyIds.has(String(s.id)),
    archived: s.active === false,
    ownershipMode: String(s.ownership_mode ?? "household"),
  }));

  const stapleCandidates = buildRecurringStapleCandidates(stapleInputs, {
    minPurchaseCount: minStapleCount,
  });

  const staples: BuildShoppingRecommendationsInput["staples"] =
    stapleCandidates.map((c) => ({
      id: c.id,
      name: c.name,
      relatedSupplyId: c.relatedSupplyId,
      typicalIntervalDays: c.typicalIntervalDays,
      daysSinceLastPurchase: c.daysSinceLastPurchase,
      lastQuantity: c.lastQuantity,
      unit: c.unit,
      purchaseCount: c.purchaseCount,
    }));

  if (
    prefs?.include_recurring_staples !== false &&
    staples.length === 0 &&
    (mode === "everything" || mode === "recurring_staples")
  ) {
    emptyReasons.push(
      `No recurring staples yet. Need at least ${minStapleCount} consistent household restocks per item.`,
    );
  }
  if (
    prefs?.include_supply_forecasts !== false &&
    supplyNeeds.every((s) => s.projectedDaysRemaining == null) &&
    (mode === "everything" || mode === "run_out_soon")
  ) {
    emptyReasons.push(
      `No runout forecasts at ${forecastThreshold} confidence. Threshold-based low-stock recommendations still apply when quantity is below restock level.`,
    );
  }

  const built = buildShoppingRecommendations({
    mealIngredients: mealIngredientNeeds,
    openRequests: openRows
      .filter((r) => {
        // Personal requests only visible to owner in shared generate
        const ownership = String(r.intended_ownership ?? "household");
        if (ownership === "personal" || ownership === "temporary") {
          return (
            String(r.intended_owner_membership_id) === params.membershipId
          );
        }
        return true;
      })
      .map((r) => ({
        id: String(r.id),
        name: String(r.name),
        quantity: r.quantity != null ? Number(r.quantity) : null,
        unit: String(r.quantity_unit ?? "item"),
        neededBy: r.needed_by ? String(r.needed_by) : null,
        ownership: String(r.intended_ownership ?? "household"),
        ownerMembershipId: r.intended_owner_membership_id
          ? String(r.intended_owner_membership_id)
          : null,
        relatedSupplyId: r.related_supply_id
          ? String(r.related_supply_id)
          : null,
      })),
    supplies: supplyNeeds,
    staples,
    sharedPurchases: (
      (sharedPurchases.data ?? []) as Array<Record<string, unknown>>
    ).map((p) => ({
      id: String(p.id),
      title: String(p.title),
      status: String(p.status),
    })),
    forgotten,
    openListNormalizedKeys: openKeys,
    horizonDays,
    includeSupplyForecasts: prefs?.include_supply_forecasts !== false,
    includeRecurringStaples: prefs?.include_recurring_staples !== false,
    includeProposedMeals: prefs?.include_proposed_meal_ingredients !== false,
    includeGuestNeeds: prefs?.include_guest_needs !== false,
    forecastConfidence: forecastThreshold,
    mode,
  });

  // Enrich staple explanations with privacy-safe text from stapleCandidates
  const stapleExplain = new Map(
    stapleCandidates.map((c) => [canonicalShoppingKey(c.name), c.explanation]),
  );
  for (const item of built) {
    if (item.reasonCodes.includes("recurring_staple")) {
      const expl = stapleExplain.get(item.normalizedKey);
      if (expl) item.explanation = expl;
    }
  }

  if (built.length === 0 && emptyReasons.length === 0) {
    emptyReasons.push(
      "No recommendations for this filter with current household data.",
    );
  }

  const fetchedAt = new Date().toISOString();
  const payload = built.map((item) => ({
    name: item.name,
    normalizedKey: item.normalizedKey,
    priorityBand: item.priorityBand,
    suggestedQuantity: item.suggestedQuantity,
    suggestedUnit: item.suggestedUnit,
    quantityBreakdown: item.quantityBreakdown,
    unitMismatch: item.unitMismatch,
    visibility: item.visibility,
    ownerMembershipId: item.ownerMembershipId,
    relatedSupplyId: item.relatedSupplyId,
    relatedPantryId: item.relatedPantryId,
    explanation: item.explanation,
    reasonCodes: item.reasonCodes,
    confidence: item.confidence,
    existingListItemId: item.existingListItemId,
    sortOrder: item.sortOrder,
    sources: item.sources,
  }));

  const persistRes = await track(
    supabase.rpc("persist_shopping_recommendation_run", {
      p_household_id: params.householdId,
      p_list_id: params.listId,
      p_mode_filter: mode,
      p_scope: "shared",
      p_items: payload,
      p_source_freshness: {
        fetchedAt,
        scoringVersion: SHOPPING_REC_VERSION,
        forecastFormulaVersion: FORECAST_FORMULA_VERSION,
        queryCount,
        emptyReasons,
      },
      p_idempotency_key: null,
    }) as PromiseLike<{ data: string | null; error: { message: string } | null }>,
  );
  const runId = persistRes.data;
  const error = persistRes.error;
  if (error || !runId) {
    throw new Error(error?.message ?? "Unable to persist recommendations.");
  }

  return {
    runId: String(runId),
    itemCount: built.length,
    fetchedAt,
    queryCount,
    emptyReasons,
    forecastFormulaVersion: FORECAST_FORMULA_VERSION,
  };
}

export async function loadLatestRecommendations(params: {
  householdId: string;
  listId: string;
}) {
  const supabase = (await createClient()) as Untyped;
  const { data: run } = await supabase
    .from("shopping_recommendation_runs")
    .select("id,created_at,mode_filter,source_freshness,status")
    .eq("household_id", params.householdId)
    .eq("list_id", params.listId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!run) return null;

  const { data: items } = await supabase
    .from("shopping_recommendation_items")
    .select(
      "id,name,priority_band,suggested_quantity,suggested_unit,explanation,confidence,status,reason_codes,unit_mismatch,quantity_breakdown,sort_order,visibility,owner_membership_id",
    )
    .eq("run_id", run.id)
    .eq("status", "suggested")
    .order("sort_order")
    .limit(60);

  const { data: sources } = await supabase
    .from("shopping_recommendation_sources")
    .select(
      "item_id,source_type,source_id,reason_code,explanation",
    )
    .eq("household_id", params.householdId)
    .in(
      "item_id",
      ((items ?? []) as Array<{ id: string }>).map((i) => i.id),
    )
    .limit(200);

  const sourcesByItem = new Map<string, Array<Record<string, unknown>>>();
  for (const s of (sources ?? []) as Array<Record<string, unknown>>) {
    const key = String(s.item_id);
    const list = sourcesByItem.get(key) ?? [];
    list.push(s);
    sourcesByItem.set(key, list);
  }

  return {
    run: {
      id: String(run.id),
      createdAt: String(run.created_at),
      modeFilter: String(run.mode_filter),
      status: String(run.status),
      sourceFreshness: (run.source_freshness ?? {}) as Record<string, unknown>,
    },
    items: ((items ?? []) as Array<Record<string, unknown>>).map((item) => ({
      id: String(item.id),
      name: String(item.name),
      priorityBand: String(item.priority_band),
      suggestedQuantity:
        item.suggested_quantity != null
          ? Number(item.suggested_quantity)
          : null,
      suggestedUnit: String(item.suggested_unit ?? "item"),
      explanation: String(item.explanation),
      confidence: String(item.confidence),
      status: String(item.status),
      reasonCodes: (item.reason_codes as string[]) ?? [],
      unitMismatch: Boolean(item.unit_mismatch),
      quantityBreakdown: item.quantity_breakdown,
      sortOrder: Number(item.sort_order ?? 0),
      visibility: String(item.visibility ?? "shared"),
      sources: (sourcesByItem.get(String(item.id)) ?? []).map((s) => ({
        sourceType: String(s.source_type),
        reasonCode: String(s.reason_code),
        explanation: String(s.explanation),
      })),
    })),
  };
}
