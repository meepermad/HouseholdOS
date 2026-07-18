"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/app/actions/auth";
import { assertActiveMembership } from "@/lib/household-context";
import { generateShoppingRecommendations } from "@/lib/shopping/recommendations/generate";
import { generateRecipeRediscovery } from "@/lib/shopping/rediscovery/generate";
import { createClient } from "@/lib/supabase/server";
import type { RecModeFilter } from "@/lib/shopping/recommendations/types";

function fail(error: string): ActionResult {
  return { ok: false, error };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Untyped = any;

export async function generateShoppingRecommendationsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = String(formData.get("householdId") ?? "");
  const listId = String(formData.get("listId") ?? "");
  const mode = (String(formData.get("mode") ?? "everything") ||
    "everything") as RecModeFilter;
  if (!householdId || !listId) return fail("Missing shopping list.");
  const ctx = await assertActiveMembership(householdId);
  try {
    const result = await generateShoppingRecommendations({
      householdId,
      membershipId: ctx.membershipId,
      listId,
      mode,
    });
    await generateRecipeRediscovery({
      householdId,
      membershipId: ctx.membershipId,
      listId,
    }).catch(() => null);
    revalidatePath(`/app/${householdId}/house/shopping/${listId}`);
    revalidatePath(`/app/${householdId}/house/shopping/recommendations`);
    return {
      ok: true,
      data: { runId: result.runId, itemCount: String(result.itemCount) },
    };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Unable to generate recommendations.");
  }
}

export async function addRecommendedItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = String(formData.get("householdId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const quantityRaw = String(formData.get("quantity") ?? "");
  const unit = String(formData.get("unit") ?? "") || null;
  if (!householdId || !itemId) return fail("Missing recommendation.");
  await assertActiveMembership(householdId);
  const supabase = (await createClient()) as Untyped;
  const { data, error } = await supabase.rpc("add_recommended_item_to_list", {
    p_item_id: itemId,
    p_quantity: quantityRaw ? Number(quantityRaw) : null,
    p_quantity_unit: unit,
    p_idempotency_key: String(formData.get("idempotencyKey") ?? "") || null,
  });
  if (error) return fail(error.message);
  revalidatePath(`/app/${householdId}/house/shopping`);
  return { ok: true, data: { shoppingItemId: String(data) } };
}

export async function dismissRecommendedItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = String(formData.get("householdId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const decision = String(formData.get("decision") ?? "dismissed");
  if (!householdId || !itemId) return fail("Missing recommendation.");
  await assertActiveMembership(householdId);
  const supabase = (await createClient()) as Untyped;
  const snoozeDays = Number(formData.get("snoozeDays") ?? 0);
  const { error } = await supabase.rpc("dismiss_shopping_recommendation", {
    p_item_id: itemId,
    p_decision: decision,
    p_snooze_until:
      snoozeDays > 0
        ? new Date(Date.now() + snoozeDays * 86400000).toISOString()
        : null,
    p_idempotency_key: String(formData.get("idempotencyKey") ?? "") || null,
  });
  if (error) return fail(error.message);
  revalidatePath(`/app/${householdId}/house/shopping`);
  return { ok: true };
}

export async function startShoppingTripAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = String(formData.get("householdId") ?? "");
  const listId = String(formData.get("listId") ?? "");
  const storeLabel = String(formData.get("storeLabel") ?? "") || null;
  if (!householdId || !listId) return fail("Missing list.");
  await assertActiveMembership(householdId);
  const supabase = (await createClient()) as Untyped;
  const { data, error } = await supabase.rpc("start_shopping_trip", {
    p_household_id: householdId,
    p_list_id: listId,
    p_store_label: storeLabel,
    p_idempotency_key: String(formData.get("idempotencyKey") ?? "") || null,
  });
  if (error || !data) return fail(error?.message ?? "Unable to start trip.");
  redirect(`/app/${householdId}/house/shopping/${listId}/trip?tripId=${data}`);
}

export async function completeShoppingTripAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = String(formData.get("householdId") ?? "");
  const tripId = String(formData.get("tripId") ?? "");
  const listId = String(formData.get("listId") ?? "");
  if (!householdId || !tripId) return fail("Missing trip.");
  await assertActiveMembership(householdId);
  const supabase = (await createClient()) as Untyped;
  const { error } = await supabase.rpc("complete_shopping_trip", {
    p_trip_id: tripId,
  });
  if (error) return fail(error.message);
  revalidatePath(`/app/${householdId}/house/shopping/${listId}`);
  return { ok: true };
}

export async function markTripItemUnavailableAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = String(formData.get("householdId") ?? "");
  const tripId = String(formData.get("tripId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  if (!householdId || !tripId || !itemId) return fail("Missing trip item.");
  await assertActiveMembership(householdId);
  const supabase = (await createClient()) as Untyped;
  const { error } = await supabase.rpc("record_shopping_trip_event", {
    p_trip_id: tripId,
    p_shopping_item_id: itemId,
    p_event_type: "unavailable",
    p_payload: {},
  });
  if (error) return fail(error.message);
  revalidatePath(`/app/${householdId}/house/shopping`);
  return { ok: true };
}

export async function decideRediscoveryAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = String(formData.get("householdId") ?? "");
  const suggestionId = String(formData.get("suggestionId") ?? "");
  const decision = String(formData.get("decision") ?? "not_this_time");
  if (!householdId || !suggestionId) return fail("Missing suggestion.");
  await assertActiveMembership(householdId);
  const supabase = (await createClient()) as Untyped;
  const { error } = await supabase.rpc("decide_recipe_rediscovery", {
    p_suggestion_id: suggestionId,
    p_decision: decision,
    p_idempotency_key: String(formData.get("idempotencyKey") ?? "") || null,
  });
  if (error) return fail(error.message);
  revalidatePath(`/app/${householdId}/house`);
  revalidatePath(`/app/${householdId}/house/recipes/rediscover`);
  return { ok: true };
}

export async function updateShoppingIntelSettingsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = String(formData.get("householdId") ?? "");
  if (!householdId) return fail("Missing household.");
  await assertActiveMembership(householdId);
  const supabase = (await createClient()) as Untyped;
  const bool = (key: string) => formData.get(key) === "on";
  const { error } = await supabase.rpc(
    "update_shopping_recommendation_preferences",
    {
      p_household_id: householdId,
      p_enabled: bool("enabled"),
      p_include_supply_forecasts: bool("includeSupplyForecasts"),
      p_include_recurring_staples: bool("includeRecurringStaples"),
      p_include_proposed_meal_ingredients: bool("includeProposedMeals"),
      p_include_guest_needs: bool("includeGuestNeeds"),
      p_forecast_confidence_threshold: String(
        formData.get("forecastConfidence") ?? "medium",
      ),
      p_recommendation_horizon_days: Number(
        formData.get("horizonDays") ?? 10,
      ),
      p_show_personal_separately: bool("showPersonalSeparately"),
      p_rediscovery_enabled: bool("rediscoveryEnabled"),
      p_rediscovery_cadence: String(formData.get("rediscoveryCadence") ?? "smart"),
      p_min_days_since_prepared: Number(formData.get("minDays") ?? 45),
      p_max_suggestions_per_trip: Number(formData.get("maxSuggestions") ?? 2),
      p_allow_push_reminders: bool("allowPush"),
      p_include_guest_friendly: bool("includeGuestFriendly"),
      p_include_meal_prep_favorites: bool("includeMealPrep"),
    },
  );
  if (error) return fail(error.message);
  revalidatePath(`/app/${householdId}/settings/shopping`);
  return { ok: true };
}
