import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  buildShoppingRecommendations,
  type BuildShoppingRecommendationsInput,
} from "@/lib/shopping/recommendations/build";
import { canonicalShoppingKey } from "@/lib/shopping/recommendations/normalize";
import type { RecModeFilter } from "@/lib/shopping/recommendations/types";
import { SHOPPING_REC_VERSION } from "@/lib/shopping/recommendations/types";
import { OPEN_SHOPPING_STATUSES } from "@/lib/house/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Untyped = any;

export async function generateShoppingRecommendations(params: {
  householdId: string;
  membershipId: string;
  listId: string;
  mode?: RecModeFilter;
}): Promise<{ runId: string; itemCount: number; fetchedAt: string }> {
  const supabase = (await createClient()) as Untyped;
  await supabase.rpc("ensure_shopping_recommendation_preferences", {
    p_household_id: params.householdId,
  });

  const { data: prefs } = await supabase
    .from("shopping_recommendation_preferences")
    .select("*")
    .eq("household_id", params.householdId)
    .maybeSingle();

  const horizonDays = (prefs?.recommendation_horizon_days as number) ?? 10;
  const mode = params.mode ?? "everything";

  const [
    listItems,
    supplies,
    mealPlans,
    sharedPurchases,
    stillNeeded,
  ] = await Promise.all([
    supabase
      .from("shopping_list_items")
      .select(
        "id,name,quantity,quantity_unit,status,needed_by,intended_ownership,intended_owner_membership_id,related_supply_id",
      )
      .eq("household_id", params.householdId)
      .eq("list_id", params.listId)
      .in("status", [...OPEN_SHOPPING_STATUSES]),
    supabase
      .from("supply_items")
      .select("id,name,quantity,reorder_threshold,stock_state")
      .eq("household_id", params.householdId)
      .eq("active", true)
      .limit(80),
    supabase
      .from("meal_plans")
      .select("id,custom_meal_name,status,meal_date,guest_count,recipe_id")
      .eq("household_id", params.householdId)
      .in("status", ["planned", "shopping_needed", "ready", "preparing"])
      .limit(20),
    supabase
      .from("shared_purchase_proposals")
      .select("id,title,status")
      .eq("household_id", params.householdId)
      .in("status", ["proposed", "approved"])
      .limit(20),
    supabase
      .from("shopping_trip_events")
      .select("id,shopping_item_id,event_type,created_at")
      .eq("household_id", params.householdId)
      .eq("event_type", "still_needed")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const openRows = (listItems.data ?? []) as Array<Record<string, unknown>>;
  const openKeys = openRows.map((r) => canonicalShoppingKey(String(r.name)));

  const mealIngredientNeeds: BuildShoppingRecommendationsInput["mealIngredients"] =
    [];
  const plans = (mealPlans.data ?? []) as Array<Record<string, unknown>>;
  for (const plan of plans) {
    const { data: ingredients } = await supabase
      .from("meal_plan_ingredients")
      .select(
        "id,display_name,scaled_quantity,required_quantity,quantity_unit,required,checklist_status",
      )
      .eq("meal_plan_id", plan.id)
      .eq("required", true)
      .in("checklist_status", ["needed", "on_shopping_list"])
      .limit(40);
    const scheduled = plan.meal_date ? String(plan.meal_date).slice(0, 10) : null;
    const soon =
      scheduled != null &&
      Date.parse(`${scheduled}T00:00:00Z`) - Date.now() < 3 * 86400000;
    const mealLabel = String(plan.custom_meal_name ?? "Planned meal");
    for (const ing of (ingredients.data ?? []) as Array<Record<string, unknown>>) {
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
  }

  const forgotten: BuildShoppingRecommendationsInput["forgotten"] = [];
  for (const ev of (stillNeeded.data ?? []) as Array<Record<string, unknown>>) {
    if (!ev.shopping_item_id) continue;
    const { data: item } = await supabase
      .from("shopping_list_items")
      .select("id,name,quantity,quantity_unit,status")
      .eq("id", ev.shopping_item_id)
      .maybeSingle();
    if (!item) continue;
    if (["purchased", "cancelled"].includes(String(item.status))) continue;
    forgotten.push({
      id: String(ev.id),
      name: String(item.name),
      quantity: item.quantity != null ? Number(item.quantity) : null,
      unit: String(item.quantity_unit ?? "item"),
    });
  }

  const built = buildShoppingRecommendations({
    mealIngredients: mealIngredientNeeds,
    openRequests: openRows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      quantity: r.quantity != null ? Number(r.quantity) : null,
      unit: String(r.quantity_unit ?? "item"),
      neededBy: r.needed_by ? String(r.needed_by) : null,
      ownership: String(r.intended_ownership ?? "household"),
      ownerMembershipId: r.intended_owner_membership_id
        ? String(r.intended_owner_membership_id)
        : null,
      relatedSupplyId: r.related_supply_id ? String(r.related_supply_id) : null,
    })),
    supplies: ((supplies.data ?? []) as Array<Record<string, unknown>>).map(
      (s) => ({
        id: String(s.id),
        name: String(s.name),
        quantity: s.quantity != null ? Number(s.quantity) : null,
        reorderThreshold:
          s.reorder_threshold != null ? Number(s.reorder_threshold) : null,
        stockState: String(s.stock_state ?? "unknown"),
        projectedDaysRemaining: null,
        purchaseCount: 0,
      }),
    ),
    staples: [],
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
    forecastConfidence:
      (prefs?.forecast_confidence_threshold as "low" | "medium" | "high") ??
      "medium",
    mode,
  });

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

  const { data: runId, error } = await supabase.rpc(
    "persist_shopping_recommendation_run",
    {
      p_household_id: params.householdId,
      p_list_id: params.listId,
      p_mode_filter: mode,
      p_scope: "shared",
      p_items: payload,
      p_source_freshness: {
        fetchedAt,
        scoringVersion: SHOPPING_REC_VERSION,
      },
      p_idempotency_key: null,
    },
  );
  if (error || !runId) {
    throw new Error(error?.message ?? "Unable to persist recommendations.");
  }

  return {
    runId: String(runId),
    itemCount: built.length,
    fetchedAt,
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
      "id,name,priority_band,suggested_quantity,suggested_unit,explanation,confidence,status,reason_codes,unit_mismatch,quantity_breakdown,sort_order",
    )
    .eq("run_id", run.id)
    .eq("status", "suggested")
    .order("sort_order")
    .limit(60);

  return {
    run: {
      id: String(run.id),
      createdAt: String(run.created_at),
      mode: String(run.mode_filter) as RecModeFilter,
      freshness: run.source_freshness as Record<string, unknown>,
    },
    items: ((items ?? []) as Array<Record<string, unknown>>).map((i) => ({
      id: String(i.id),
      name: String(i.name),
      priorityBand: String(i.priority_band),
      suggestedQuantity:
        i.suggested_quantity != null ? Number(i.suggested_quantity) : null,
      suggestedUnit: String(i.suggested_unit ?? "item"),
      explanation: String(i.explanation),
      confidence: String(i.confidence),
      unitMismatch: Boolean(i.unit_mismatch),
      quantityBreakdown: (i.quantity_breakdown as unknown[]) ?? [],
      reasonCodes: (i.reason_codes as string[]) ?? [],
    })),
  };
}
