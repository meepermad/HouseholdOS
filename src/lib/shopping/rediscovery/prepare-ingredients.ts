import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { QuantityUnit } from "@/lib/house/types";
import { OPEN_SHOPPING_STATUSES } from "@/lib/house/types";
import type { AuthorizedPantryItem } from "@/lib/meals/match";
import type { ActiveShoppingItem } from "@/lib/meals/shopping-prep";
import {
  buildRediscoveryMissingIngredientProposal,
  type MissingIngredientProposal,
} from "@/lib/shopping/rediscovery/missing-ingredients";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Untyped = any;

export type PreparedRediscoveryIngredients = {
  proposalId: string;
  suggestionId: string;
  recipeId: string;
  recipeName: string;
  listId: string;
  householdName: string;
  proposal: MissingIngredientProposal;
};

function recipeVisibleToViewer(
  recipe: Record<string, unknown>,
  membershipId: string,
  selectedMemberIds: Set<string>,
): boolean {
  if (recipe.archived_at) return false;
  const visibility = String(recipe.visibility ?? "household");
  if (visibility === "household") return true;
  if (visibility === "creator_only") {
    return String(recipe.created_by_membership_id) === membershipId;
  }
  if (visibility === "selected_members") {
    return (
      String(recipe.created_by_membership_id) === membershipId ||
      selectedMemberIds.has(membershipId)
    );
  }
  return false;
}

/**
 * Recalculate missing ingredients for a Forgotten Favorite and persist a draft proposal.
 */
export async function prepareRediscoveryIngredients(params: {
  householdId: string;
  membershipId: string;
  suggestionId: string;
  listId?: string | null;
  idempotencyKey?: string | null;
}): Promise<PreparedRediscoveryIngredients> {
  const supabase = (await createClient()) as Untyped;

  const { data: suggestion, error: sugErr } = await supabase
    .from("recipe_rediscovery_suggestions")
    .select("id,household_id,recipe_id,status")
    .eq("id", params.suggestionId)
    .eq("household_id", params.householdId)
    .maybeSingle();
  if (sugErr || !suggestion) {
    throw new Error("Suggestion not found or not authorized.");
  }
  if (String(suggestion.status) !== "suggested") {
    throw new Error("This suggestion is no longer open for ingredient review.");
  }

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id,name,visibility,archived_at,created_by_membership_id")
    .eq("id", suggestion.recipe_id)
    .eq("household_id", params.householdId)
    .maybeSingle();
  if (!recipe) {
    throw new Error("Recipe is not available.");
  }

  const { data: visMembers } = await supabase
    .from("recipe_visibility_members")
    .select("membership_id")
    .eq("recipe_id", recipe.id)
    .eq("household_id", params.householdId);
  const selected = new Set(
    ((visMembers ?? []) as Array<{ membership_id: string }>).map((m) =>
      String(m.membership_id),
    ),
  );

  if (!recipeVisibleToViewer(recipe, params.membershipId, selected)) {
    throw new Error("You are not authorized to view this recipe.");
  }

  const { data: listIdRaw } = params.listId
    ? { data: params.listId }
    : await supabase.rpc("ensure_default_shopping_list", {
        p_household_id: params.householdId,
      });
  const listId = String(listIdRaw);

  const [{ data: ingredients }, { data: pantryRows }, { data: shoppingRows }, { data: household }] =
    await Promise.all([
      supabase
        .from("recipe_ingredients")
        .select(
          "id,display_name,quantity,quantity_unit,quantity_mode,required",
        )
        .eq("recipe_id", recipe.id)
        .eq("household_id", params.householdId)
        .order("sort_order")
        .limit(80),
      supabase
        .from("pantry_items")
        .select(
          "id,name,normalized_name,quantity,quantity_unit,quantity_is_approximate,state,use_soon_at,ownership_mode,visibility,owner_membership_id",
        )
        .eq("household_id", params.householdId)
        .limit(200),
      supabase
        .from("shopping_list_items")
        .select(
          "id,name,quantity,quantity_unit,status,related_recipe_ingredient_id,related_meal_plan_id",
        )
        .eq("household_id", params.householdId)
        .eq("list_id", listId)
        .in("status", [...OPEN_SHOPPING_STATUSES, "purchased"])
        .limit(200),
      supabase
        .from("households")
        .select("name")
        .eq("id", params.householdId)
        .maybeSingle(),
    ]);

  const pantry: AuthorizedPantryItem[] = (
    (pantryRows ?? []) as Array<Record<string, unknown>>
  )
    .filter((p) => {
      if (["finished", "discarded"].includes(String(p.state))) return false;
      const visibility = String(p.visibility ?? "household");
      if (visibility === "household") return true;
      if (visibility === "owner_only") {
        return String(p.owner_membership_id) === params.membershipId;
      }
      return String(p.owner_membership_id) === params.membershipId;
    })
    .map((p) => ({
      id: String(p.id),
      name: String(p.name),
      normalizedName: p.normalized_name ? String(p.normalized_name) : null,
      quantity: p.quantity != null ? String(p.quantity) : null,
      unit: String(p.quantity_unit ?? "item") as QuantityUnit,
      quantityIsApproximate: Boolean(p.quantity_is_approximate),
      state: String(p.state ?? "unknown"),
      useSoonAt: p.use_soon_at ? String(p.use_soon_at) : null,
      communalAvailable: String(p.ownership_mode) === "household",
      ownershipMode: String(p.ownership_mode),
      usableByViewer: true,
      isStaple: false,
    }));

  const activeShopping: ActiveShoppingItem[] = (
    (shoppingRows ?? []) as Array<Record<string, unknown>>
  ).map((s) => ({
    id: String(s.id),
    name: String(s.name),
    quantity: s.quantity != null ? String(s.quantity) : null,
    unit: String(s.quantity_unit ?? "item") as QuantityUnit,
    status: String(s.status),
    relatedRecipeIngredientId: s.related_recipe_ingredient_id
      ? String(s.related_recipe_ingredient_id)
      : null,
    relatedMealPlanId: s.related_meal_plan_id
      ? String(s.related_meal_plan_id)
      : null,
  }));

  const proposal = buildRediscoveryMissingIngredientProposal({
    ingredients: ((ingredients ?? []) as Array<Record<string, unknown>>).map(
      (ing) => ({
        id: String(ing.id),
        displayName: String(ing.display_name),
        quantity: ing.quantity != null ? String(ing.quantity) : null,
        unit: String(ing.quantity_unit ?? "item") as QuantityUnit,
        quantityMode: (() => {
          const mode = String(ing.quantity_mode ?? "exact");
          if (
            mode === "exact" ||
            mode === "optional" ||
            mode === "approximate" ||
            mode === "to_taste" ||
            mode === "as_needed"
          ) {
            return mode;
          }
          return "approximate" as const;
        })(),
        required: Boolean(ing.required),
      }),
    ),
    pantry,
    activeShopping,
  });

  const linesPayload = proposal.lines.map((line) => ({
    recipeIngredientId: line.recipeIngredientId,
    displayName: line.displayName,
    required: line.required,
    requiredQuantity: line.requiredQuantity,
    shortfallQuantity: line.shortfallQuantity,
    quantityUnit: line.quantityUnit,
    lineStatus: line.lineStatus,
    unitMismatch: line.unitMismatch,
    excluded: line.excluded,
    alreadyOnList: line.alreadyOnList,
    existingListItemId: line.existingListItemId,
  }));

  const { data: proposalId, error } = await supabase.rpc(
    "persist_rediscovery_ingredient_proposal",
    {
      p_suggestion_id: params.suggestionId,
      p_list_id: listId,
      p_lines: linesPayload,
      p_idempotency_key: params.idempotencyKey ?? null,
    },
  );
  if (error || !proposalId) {
    throw new Error(error?.message ?? "Unable to prepare ingredient proposal.");
  }

  return {
    proposalId: String(proposalId),
    suggestionId: params.suggestionId,
    recipeId: String(recipe.id),
    recipeName: String(recipe.name),
    listId,
    householdName: String(household?.name ?? "Household"),
    proposal,
  };
}
