import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  scoreRediscoveryCandidate,
  shouldShowRediscovery,
  type RediscoveryCadence,
} from "@/lib/shopping/rediscovery/score";
import { canonicalShoppingKey } from "@/lib/shopping/recommendations/normalize";
import { OPEN_SHOPPING_STATUSES } from "@/lib/house/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Untyped = any;

export async function generateRecipeRediscovery(params: {
  householdId: string;
  membershipId: string;
  listId: string | null;
  tripId?: string | null;
}): Promise<{ count: number; suggestionIds: string[] }> {
  const supabase = (await createClient()) as Untyped;
  await supabase.rpc("ensure_shopping_recommendation_preferences", {
    p_household_id: params.householdId,
  });

  const { data: prefs } = await supabase
    .from("recipe_rediscovery_preferences")
    .select("*")
    .eq("household_id", params.householdId)
    .maybeSingle();

  if (prefs && prefs.enabled === false) {
    return { count: 0, suggestionIds: [] };
  }

  const cadence = (prefs?.cadence as RediscoveryCadence) ?? "smart";
  const minDays = (prefs?.min_days_since_prepared as number) ?? 45;
  const maxSuggestions = (prefs?.max_suggestions_per_trip as number) ?? 2;

  const { data: lastSug } = await supabase
    .from("recipe_rediscovery_suggestions")
    .select("shown_at")
    .eq("household_id", params.householdId)
    .order("shown_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const daysSinceLast = lastSug?.shown_at
    ? Math.floor(
        (Date.now() - Date.parse(String(lastSug.shown_at))) / 86400000,
      )
    : null;

  const { count: tripCount } = await supabase
    .from("shopping_trip_sessions")
    .select("id", { count: "exact", head: true })
    .eq("household_id", params.householdId)
    .gte(
      "started_at",
      lastSug?.shown_at ?? "1970-01-01T00:00:00Z",
    );

  const { data: history } = await supabase
    .from("recipe_prep_history")
    .select("recipe_id,times_prepared,last_prepared_at,last_successful_for_guests,last_used_for_meal_prep")
    .eq("household_id", params.householdId)
    .limit(80);

  const { data: prefsRows } = await supabase
    .from("recipe_user_preferences")
    .select(
      "recipe_id,preference_signal,is_favorite,would_make_again,meal_prep_usefulness,guest_friendliness",
    )
    .eq("household_id", params.householdId)
    .limit(200);

  const { data: snoozes } = await supabase
    .from("recipe_suggestion_snoozes")
    .select("recipe_id,reason,snooze_until")
    .eq("household_id", params.householdId);

  const { data: listItems } = params.listId
    ? await supabase
        .from("shopping_list_items")
        .select("name")
        .eq("list_id", params.listId)
        .in("status", [...OPEN_SHOPPING_STATUSES])
    : { data: [] };

  const listKeys = new Set(
    ((listItems ?? []) as Array<{ name: string }>).map((i) =>
      canonicalShoppingKey(i.name),
    ),
  );

  const positiveRecipeIds = new Set<string>();
  const prefByRecipe = new Map<string, Array<Record<string, unknown>>>();
  for (const p of (prefsRows ?? []) as Array<Record<string, unknown>>) {
    const rid = String(p.recipe_id);
    const list = prefByRecipe.get(rid) ?? [];
    list.push(p);
    prefByRecipe.set(rid, list);
    if (
      p.is_favorite ||
      p.would_make_again === true ||
      p.preference_signal === "favorite" ||
      p.preference_signal === "would_make_again"
    ) {
      positiveRecipeIds.add(rid);
    }
  }

  const snoozeMap = new Map(
    ((snoozes ?? []) as Array<Record<string, unknown>>).map((s) => [
      String(s.recipe_id),
      s,
    ]),
  );

  const results = [];
  for (const h of (history ?? []) as Array<Record<string, unknown>>) {
    const recipeId = String(h.recipe_id);
    if (!positiveRecipeIds.has(recipeId) && !prefByRecipe.has(recipeId)) {
      continue;
    }
    const snooze = snoozeMap.get(recipeId);
    const snoozed =
      snooze != null &&
      (snooze.reason === "suppress" ||
        (snooze.snooze_until != null &&
          Date.parse(String(snooze.snooze_until)) > Date.now()));

    const { data: recipe } = await supabase
      .from("recipes")
      .select("id,name,archived_at,visibility")
      .eq("id", recipeId)
      .eq("household_id", params.householdId)
      .maybeSingle();
    if (!recipe || recipe.archived_at) continue;
    if (String(recipe.visibility) === "creator_only") continue;

    const { data: ingredients } = await supabase
      .from("recipe_ingredients")
      .select("display_name,required")
      .eq("recipe_id", recipeId)
      .eq("required", true)
      .limit(30);

    const ings = (ingredients.data ?? []) as Array<{ display_name: string }>;
    let pantryHave = 0;
    let shoppingOverlap = 0;
    for (const ing of ings) {
      const key = canonicalShoppingKey(ing.display_name);
      if (listKeys.has(key)) {
        shoppingOverlap += 1;
        pantryHave += 1;
      }
    }

    const memberPrefs = prefByRecipe.get(recipeId) ?? [];
    const isFavorite = memberPrefs.some(
      (p) => p.is_favorite || p.preference_signal === "favorite",
    );
    const wouldMakeAgain = memberPrefs.some(
      (p) =>
        p.would_make_again === true ||
        p.preference_signal === "would_make_again",
    );
    const wouldNot = memberPrefs.some(
      (p) => p.preference_signal === "would_not_choose_again",
    );
    const daysSince = h.last_prepared_at
      ? Math.floor(
          (Date.now() - Date.parse(String(h.last_prepared_at))) / 86400000,
        )
      : null;

    const scored = scoreRediscoveryCandidate(
      {
        recipeId,
        recipeName: String(recipe.name),
        daysSincePrepared: daysSince,
        neverPrepared: !h.last_prepared_at,
        isFavorite,
        wouldMakeAgain,
        wouldNotChooseAgain: wouldNot,
        okayOnly: memberPrefs.every((p) => p.preference_signal === "okay"),
        dietaryConflict: false,
        pantryHave,
        pantryTotal: Math.max(1, ings.length),
        shoppingOverlap,
        useSoonBonus: false,
        guestFriendly:
          Boolean(h.last_successful_for_guests) ||
          (prefs?.include_guest_friendly !== false &&
            memberPrefs.some(
              (p) =>
                p.guest_friendliness != null &&
                Number(p.guest_friendliness) >= 4,
            )),
        mealPrepFavorite:
          Boolean(h.last_used_for_meal_prep) ||
          (prefs?.include_meal_prep_favorites !== false &&
            memberPrefs.some(
              (p) =>
                p.meal_prep_usefulness != null &&
                Number(p.meal_prep_usefulness) >= 4,
            )),
        snoozed: Boolean(snoozed),
        suppressed: snooze?.reason === "suppress",
        dismissedRecently: false,
        expectedRevisitDays: minDays,
        preferenceFit: wouldNot
          ? "negative"
          : isFavorite
            ? "strong"
            : wouldMakeAgain
              ? "positive"
              : "neutral",
      },
      minDays,
    );
    if (scored.eligible) results.push(scored);
  }

  results.sort((a, b) => b.score - a.score);
  const strong = results.slice(0, Math.max(3, maxSuggestions));

  if (
    !shouldShowRediscovery({
      cadence,
      daysSinceLastSuggestion: daysSinceLast,
      tripsSinceLastSuggestion: tripCount ?? 0,
      strongCandidateCount: strong.length,
      hasAcceptedMeals: false,
    })
  ) {
    return { count: 0, suggestionIds: [] };
  }

  const top = strong.slice(0, maxSuggestions);
  const payload = top.map((r) => ({
    recipeId: r.recipeId,
    score: r.score,
    explanation: r.explanation,
    reasonCodes: r.reasonCodes,
    pantryHave: r.pantryHave,
    pantryTotal: r.pantryTotal,
    missingSummary: [],
    preferenceFit: r.preferenceFit,
  }));

  await supabase.rpc("persist_recipe_rediscovery_suggestions", {
    p_household_id: params.householdId,
    p_list_id: params.listId,
    p_trip_id: params.tripId ?? null,
    p_suggestions: payload,
    p_idempotency_key: `rediscover-${params.listId ?? "none"}-${new Date().toISOString().slice(0, 10)}`,
  });

  const { data: saved } = await supabase
    .from("recipe_rediscovery_suggestions")
    .select("id")
    .eq("household_id", params.householdId)
    .eq("status", "suggested")
    .order("shown_at", { ascending: false })
    .limit(maxSuggestions);

  return {
    count: top.length,
    suggestionIds: ((saved ?? []) as Array<{ id: string }>).map((s) => s.id),
  };
}
