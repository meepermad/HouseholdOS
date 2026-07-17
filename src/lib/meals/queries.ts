import { createClient } from "@/lib/supabase/server";

// Meal migrations may precede regenerated database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;

export type RecipeListItem = {
  id: string;
  name: string;
  category: string;
  baseServings: number;
  totalMinutes: number | null;
  visibility: string;
  archivedAt: string | null;
};

export type MealPlanListItem = {
  id: string;
  title: string;
  mealType: string;
  mealDate: string;
  status: string;
  targetServings: number;
  guestCount: number;
  recipeId: string | null;
};

export type MealBatchListItem = {
  id: string;
  name: string;
  remainingState: string;
  preparedAt: string;
  availability: string;
};

async function db(): Promise<UntypedDb> {
  return (await createClient()) as UntypedDb;
}

export async function listRecipes(
  householdId: string,
  opts: { search?: string; category?: string; limit?: number } = {},
): Promise<RecipeListItem[]> {
  const supabase = await db();
  let q = supabase
    .from("recipes")
    .select("id,name,category,base_servings,total_minutes,visibility,archived_at")
    .eq("household_id", householdId)
    .is("archived_at", null)
    .order("name")
    .limit(opts.limit ?? 50);
  if (opts.category) q = q.eq("category", opts.category);
  if (opts.search) q = q.ilike("name", `%${opts.search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    category: r.category as string,
    baseServings: Number(r.base_servings),
    totalMinutes: r.total_minutes as number | null,
    visibility: r.visibility as string,
    archivedAt: r.archived_at as string | null,
  }));
}

export async function getRecipe(householdId: string, recipeId: string) {
  const supabase = await db();
  const [{ data: recipe, error }, { data: ingredients }, { data: steps }, { data: equipment }] =
    await Promise.all([
      supabase
        .from("recipes")
        .select("*")
        .eq("household_id", householdId)
        .eq("id", recipeId)
        .maybeSingle(),
      supabase
        .from("recipe_ingredients")
        .select("*")
        .eq("recipe_id", recipeId)
        .order("sort_order"),
      supabase
        .from("recipe_steps")
        .select("*")
        .eq("recipe_id", recipeId)
        .order("step_number"),
      supabase
        .from("recipe_equipment")
        .select("*")
        .eq("recipe_id", recipeId)
        .order("sort_order"),
    ]);
  if (error) throw error;
  if (!recipe) return null;
  return {
    recipe,
    ingredients: ingredients ?? [],
    steps: steps ?? [],
    equipment: equipment ?? [],
  };
}

export async function listMealPlansForWeek(
  householdId: string,
  weekStart: string,
  weekEnd: string,
): Promise<MealPlanListItem[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("meal_plans")
    .select(
      "id,title,meal_type,meal_date,status,target_servings,guest_count,recipe_id",
    )
    .eq("household_id", householdId)
    .gte("meal_date", weekStart)
    .lte("meal_date", weekEnd)
    .neq("status", "cancelled")
    .order("meal_date");
  if (error) throw error;
  return (data ?? []).map((m: Record<string, unknown>) => ({
    id: m.id as string,
    title: m.title as string,
    mealType: m.meal_type as string,
    mealDate: m.meal_date as string,
    status: m.status as string,
    targetServings: Number(m.target_servings),
    guestCount: Number(m.guest_count),
    recipeId: m.recipe_id as string | null,
  }));
}

export async function getMealPlan(householdId: string, mealId: string) {
  const supabase = await db();
  const [
    { data: plan, error },
    { data: attendees },
    { data: ingredients },
    { data: proposal },
  ] = await Promise.all([
    supabase
      .from("meal_plans")
      .select("*")
      .eq("household_id", householdId)
      .eq("id", mealId)
      .maybeSingle(),
    supabase.from("meal_attendees").select("*").eq("meal_plan_id", mealId),
    supabase
      .from("meal_plan_ingredients")
      .select("*")
      .eq("meal_plan_id", mealId)
      .order("sort_order"),
    supabase
      .from("meal_shopping_proposals")
      .select("*, meal_shopping_proposal_lines(*)")
      .eq("meal_plan_id", mealId)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (error) throw error;
  if (!plan) return null;
  return {
    plan,
    attendees: attendees ?? [],
    ingredients: ingredients ?? [],
    proposal: proposal ?? null,
  };
}

export async function listMealPrepBatches(
  householdId: string,
): Promise<MealBatchListItem[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("meal_prep_batches")
    .select("id,name,remaining_state,prepared_at,availability")
    .eq("household_id", householdId)
    .is("discarded_at", null)
    .order("prepared_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((b: Record<string, unknown>) => ({
    id: b.id as string,
    name: b.name as string,
    remainingState: b.remaining_state as string,
    preparedAt: b.prepared_at as string,
    availability: b.availability as string,
  }));
}

export async function getMealBatch(householdId: string, batchId: string) {
  const supabase = await db();
  const { data, error } = await supabase
    .from("meal_prep_batches")
    .select("*")
    .eq("household_id", householdId)
    .eq("id", batchId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMealSettings(householdId: string) {
  const supabase = await db();
  const { data, error } = await supabase
    .from("household_meal_settings")
    .select("*")
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) throw error;
  return (
    data ?? {
      household_id: householdId,
      assume_staples_available: false,
      shopping_prep_policy: "suggest_and_confirm",
    }
  );
}

export async function getMealRequest(householdId: string, requestId: string) {
  const supabase = await db();
  const [{ data: request, error }, { data: results }] = await Promise.all([
    supabase
      .from("meal_requests")
      .select("*")
      .eq("household_id", householdId)
      .eq("id", requestId)
      .maybeSingle(),
    supabase
      .from("meal_request_results")
      .select("*, recipes(id,name,total_minutes,category)")
      .eq("meal_request_id", requestId)
      .order("rank_position"),
  ]);
  if (error) throw error;
  if (!request) return null;
  return { request, results: results ?? [] };
}
