"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/app/actions/auth";
import { assertActiveMembership } from "@/lib/household-context";
import { can, type Capability } from "@/lib/permissions";
import { toPublicErrorMessage } from "@/lib/errors";
import {
  acceptMealRequestSchema,
  confirmShoppingPrepSchema,
  createMealPlanSchema,
  createMealRequestSchema,
  createRecipeSchema,
  markPreparedSchema,
  mealSettingsSchema,
  respondMealSchema,
  updateBatchRemainingSchema,
} from "@/lib/validations/meals";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;
const str = (value: FormDataEntryValue | null) => String(value ?? "").trim();
const optional = (value: FormDataEntryValue | null) => str(value) || null;
const bool = (value: FormDataEntryValue | null) =>
  value === "true" || value === "on";

function invalidate(householdId: string) {
  revalidatePath(`/app/${householdId}/meals`);
  revalidatePath(`/app/${householdId}/recipes`);
  revalidatePath(`/app/${householdId}/meal-prep`);
  revalidatePath(`/app/${householdId}/settings/meals`);
  revalidatePath(`/app/${householdId}/house`);
}

async function context(householdId: string, capability: Capability) {
  const ctx = await assertActiveMembership(householdId);
  if (!can(ctx.roles, capability)) {
    throw new Error("You are not allowed to perform this meal action.");
  }
  const { createClient } = await import("@/lib/supabase/server");
  return { ctx, supabase: (await createClient()) as UntypedDb };
}

export async function createRecipeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = createRecipeSchema.safeParse({
      householdId: str(formData.get("householdId")),
      name: str(formData.get("name")),
      description: optional(formData.get("description")),
      category: str(formData.get("category")) || "other",
      baseServings: str(formData.get("baseServings")) || "4",
      prepMinutes: optional(formData.get("prepMinutes")),
      cookMinutes: optional(formData.get("cookMinutes")),
      difficulty: str(formData.get("difficulty")) || "unknown",
      visibility: str(formData.get("visibility")) || "household",
      sourceUrl: optional(formData.get("sourceUrl")),
      ingredientsJson: str(formData.get("ingredientsJson")) || "[]",
      stepsJson: str(formData.get("stepsJson")) || "[]",
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "meal.create");
    let ingredients = [];
    let steps = [];
    try {
      ingredients = JSON.parse(d.ingredientsJson);
      steps = JSON.parse(d.stepsJson);
    } catch {
      return { ok: false, error: "Ingredients or steps JSON is invalid." };
    }
    const { data, error } = await supabase.rpc("create_recipe", {
      p_household_id: d.householdId,
      p_name: d.name,
      p_description: d.description,
      p_category: d.category,
      p_base_servings: d.baseServings,
      p_prep_minutes: d.prepMinutes,
      p_cook_minutes: d.cookMinutes,
      p_difficulty: d.difficulty,
      p_visibility: d.visibility,
      p_source_url: d.sourceUrl,
      p_ingredients: ingredients,
      p_steps: steps,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(d.householdId);
    redirect(`/app/${d.householdId}/recipes/${data}`);
  } catch (error) {
    if ((error as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function createMealPlanAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = createMealPlanSchema.safeParse({
      householdId: str(formData.get("householdId")),
      mealType: str(formData.get("mealType")) || "shared_household",
      title: str(formData.get("title")),
      mealDate: str(formData.get("mealDate")),
      recipeId: optional(formData.get("recipeId")),
      targetServings: str(formData.get("targetServings")) || "4",
      guestCount: str(formData.get("guestCount")) || "0",
      linkCalendar: bool(formData.get("linkCalendar")),
      notes: optional(formData.get("notes")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "meal.create");
    const { data, error } = await supabase.rpc("create_meal_plan", {
      p_household_id: d.householdId,
      p_meal_type: d.mealType,
      p_title: d.title,
      p_meal_date: d.mealDate,
      p_recipe_id: d.recipeId,
      p_target_servings: d.targetServings,
      p_guest_count: d.guestCount,
      p_link_calendar: d.linkCalendar,
      p_notes: d.notes,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(d.householdId);
    redirect(`/app/${d.householdId}/meals/${data}`);
  } catch (error) {
    if ((error as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function createMealRequestAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = createMealRequestSchema.safeParse({
      householdId: str(formData.get("householdId")),
      mealType: str(formData.get("mealType")) || "shared_household",
      targetDate: optional(formData.get("targetDate")),
      guestCount: str(formData.get("guestCount")) || "0",
      desiredServings: optional(formData.get("desiredServings")),
      maxTotalMinutes: optional(formData.get("maxTotalMinutes")),
      maxMissingIngredients: optional(formData.get("maxMissingIngredients")),
      pantryOnly: bool(formData.get("pantryOnly")),
      note: optional(formData.get("note")),
      excludeIngredient: optional(formData.get("excludeIngredient")),
      prioritizeIngredient: optional(formData.get("prioritizeIngredient")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "meal.create");
    const constraints: Array<{ constraint_type: string; value: string }> = [];
    if (d.excludeIngredient) {
      constraints.push({
        constraint_type: "exclude_ingredient",
        value: d.excludeIngredient,
      });
    }
    if (d.prioritizeIngredient) {
      constraints.push({
        constraint_type: "prioritize_ingredient",
        value: d.prioritizeIngredient,
      });
    }
    const { data, error } = await supabase.rpc("create_meal_request", {
      p_household_id: d.householdId,
      p_meal_type: d.mealType,
      p_target_date: d.targetDate,
      p_guest_count: d.guestCount,
      p_desired_servings: d.desiredServings,
      p_max_total_minutes: d.maxTotalMinutes,
      p_max_missing_ingredients: d.maxMissingIngredients,
      p_pantry_only: d.pantryOnly,
      p_note: d.note,
      p_constraints: constraints,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(d.householdId);
    redirect(`/app/${d.householdId}/recipes/request?requestId=${data}`);
  } catch (error) {
    if ((error as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function acceptMealRequestAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = acceptMealRequestSchema.safeParse({
      householdId: str(formData.get("householdId")),
      mealRequestId: str(formData.get("mealRequestId")),
      recipeId: str(formData.get("recipeId")),
      mealDate: optional(formData.get("mealDate")),
      targetServings: optional(formData.get("targetServings")),
      linkCalendar: bool(formData.get("linkCalendar")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "meal.create");
    const { data, error } = await supabase.rpc("accept_meal_request_result", {
      p_meal_request_id: d.mealRequestId,
      p_recipe_id: d.recipeId,
      p_meal_date: d.mealDate,
      p_target_servings: d.targetServings,
      p_link_calendar: d.linkCalendar,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(d.householdId);
    redirect(`/app/${d.householdId}/meals/${data}/shopping`);
  } catch (error) {
    if ((error as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function respondToMealAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = respondMealSchema.safeParse({
      householdId: str(formData.get("householdId")),
      mealPlanId: str(formData.get("mealPlanId")),
      status: str(formData.get("status")),
      guestCount: str(formData.get("guestCount")) || "0",
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "meal.manage_own");
    const { error } = await supabase.rpc("respond_to_meal_plan", {
      p_meal_plan_id: d.mealPlanId,
      p_status: d.status,
      p_guest_count: d.guestCount,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(d.householdId);
    return { ok: true, message: "Attendance updated." };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function confirmMealShoppingAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = confirmShoppingPrepSchema.safeParse({
      householdId: str(formData.get("householdId")),
      proposalId: str(formData.get("proposalId")),
      excludedLineIdsJson: str(formData.get("excludedLineIdsJson")) || "[]",
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "meal.manage_own");
    let excluded: string[] = [];
    try {
      excluded = JSON.parse(d.excludedLineIdsJson);
    } catch {
      excluded = [];
    }
    const { error } = await supabase.rpc("confirm_meal_shopping_proposal", {
      p_proposal_id: d.proposalId,
      p_excluded_line_ids: excluded,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(d.householdId);
    return { ok: true, message: "Shopping list updated." };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function updateMealSettingsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = mealSettingsSchema.safeParse({
      householdId: str(formData.get("householdId")),
      assumeStaplesAvailable: bool(formData.get("assumeStaplesAvailable")),
      shoppingPrepPolicy:
        str(formData.get("shoppingPrepPolicy")) || "suggest_and_confirm",
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "meal.settings");
    const { error } = await supabase.rpc("update_household_meal_settings", {
      p_household_id: d.householdId,
      p_assume_staples_available: d.assumeStaplesAvailable,
      p_shopping_prep_policy: d.shoppingPrepPolicy,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(d.householdId);
    return { ok: true, message: "Meal settings saved." };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function markMealPreparedAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = markPreparedSchema.safeParse({
      householdId: str(formData.get("householdId")),
      mealPlanId: str(formData.get("mealPlanId")),
      createBatch: bool(formData.get("createBatch")),
      remainingState: str(formData.get("remainingState")) || "plenty",
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "meal.manage_own");
    const { error } = await supabase.rpc("mark_meal_prepared", {
      p_meal_plan_id: d.mealPlanId,
      p_create_batch: d.createBatch,
      p_remaining_state: d.remainingState,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(d.householdId);
    return { ok: true, message: "Meal marked prepared." };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function updateBatchRemainingAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = updateBatchRemainingSchema.safeParse({
      householdId: str(formData.get("householdId")),
      batchId: str(formData.get("batchId")),
      remainingState: str(formData.get("remainingState")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "meal.manage_own");
    const { error } = await supabase.rpc("update_meal_batch_remaining_state", {
      p_batch_id: d.batchId,
      p_remaining_state: d.remainingState,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(d.householdId);
    return { ok: true, message: "Leftover amount updated." };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function cancelMealPlanAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = str(formData.get("householdId"));
    const mealPlanId = str(formData.get("mealPlanId"));
    const { supabase } = await context(householdId, "meal.manage_own");
    const { error } = await supabase.rpc("cancel_meal_plan", {
      p_meal_plan_id: mealPlanId,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(householdId);
    redirect(`/app/${householdId}/meals`);
  } catch (error) {
    if ((error as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}
