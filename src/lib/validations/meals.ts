import { z } from "zod";
import {
  MEAL_TYPES,
  PREFERENCE_SCOPES,
  PREFERENCE_SIGNALS,
  PREFERENCE_FIT_SUMMARIES,
  RANKING_MODES,
} from "@/lib/meals/types";

const uuid = z.string().uuid();

/** Accept uuid[] from arrays, JSON strings, or comma-separated form fields. */
function parseStringList(value: unknown): string[] {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch {
      /* fall through to comma split */
    }
  }
  return trimmed
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

const stringListSchema = z.preprocess(parseStringList, z.array(z.string()));
const uuidListSchema = z.preprocess(parseStringList, z.array(uuid).max(40));

export const createRecipeSchema = z.object({
  householdId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  category: z.string().min(1),
  baseServings: z.coerce.number().positive(),
  prepMinutes: z.coerce.number().int().min(0).optional().nullable(),
  cookMinutes: z.coerce.number().int().min(0).optional().nullable(),
  difficulty: z.enum(["easy", "medium", "hard", "unknown"]).default("unknown"),
  visibility: z
    .enum(["household", "creator_only", "selected_members"])
    .default("household"),
  sourceUrl: z.string().trim().max(2000).optional().nullable(),
  ingredientsJson: z.string().default("[]"),
  stepsJson: z.string().default("[]"),
});

export const requestRecipeImportSchema = z.object({
  householdId: z.string().uuid(),
  sourceUrl: z
    .string()
    .trim()
    .min(8)
    .max(2000)
    .url("Enter a valid recipe URL."),
  refreshRecipeId: z.string().uuid().optional().nullable(),
});

export const saveRecipeImportSchema = z.object({
  householdId: z.string().uuid(),
  draftId: z.string().uuid(),
  recipeJson: z.string().min(2).max(250_000),
  visibility: z
    .enum(["household", "creator_only", "selected_members"])
    .default("household"),
  importAsCopy: z.boolean().default(false),
});

export const cancelRecipeImportSchema = z.object({
  householdId: z.string().uuid(),
  draftId: z.string().uuid(),
});

export const createMealPlanSchema = z.object({
  householdId: z.string().uuid(),
  mealType: z.enum([
    "shared_household",
    "guest_inclusive",
    "personal",
    "open_household",
    "meal_prep",
  ]),
  title: z.string().trim().min(1).max(200),
  mealDate: z.string().min(1),
  recipeId: z.string().uuid().optional().nullable(),
  targetServings: z.coerce.number().positive().default(4),
  guestCount: z.coerce.number().int().min(0).max(20).default(0),
  linkCalendar: z.boolean().default(false),
  notes: z.string().trim().max(4000).optional().nullable(),
});

export const createMealRequestSchema = z.object({
  householdId: z.string().uuid(),
  mealType: z.enum(MEAL_TYPES).default("shared_household"),
  rankingMode: z.enum(RANKING_MODES).default("best_overall"),
  preferenceScope: z.enum(PREFERENCE_SCOPES).default("attendees"),
  attendeeMembershipIds: uuidListSchema.default([]),
  guestConstraintLabels: stringListSchema.default([]),
  strictTimeLimit: z.boolean().default(false),
  dietaryConstraint: z.string().trim().max(200).optional().nullable(),
  targetDate: z.string().optional().nullable(),
  guestCount: z.coerce.number().int().min(0).max(20).default(0),
  desiredServings: z.coerce.number().positive().optional().nullable(),
  maxTotalMinutes: z.coerce.number().int().min(0).optional().nullable(),
  maxMissingIngredients: z.coerce.number().int().min(0).optional().nullable(),
  pantryOnly: z.boolean().default(false),
  note: z.string().trim().max(2000).optional().nullable(),
  excludeIngredient: z.string().trim().max(200).optional().nullable(),
  prioritizeIngredient: z.string().trim().max(200).optional().nullable(),
});

export const acceptMealRequestSchema = z.object({
  householdId: z.string().uuid(),
  mealRequestId: z.string().uuid(),
  recipeId: z.string().uuid(),
  mealDate: z.string().optional().nullable(),
  targetServings: z.coerce.number().positive().optional().nullable(),
  linkCalendar: z.boolean().default(false),
  attendeeMembershipIds: uuidListSchema.default([]),
});

export const setRecipePreferenceSchema = z.object({
  householdId: z.string().uuid(),
  recipeId: z.string().uuid(),
  preferenceSignal: z.enum(PREFERENCE_SIGNALS),
  isFavorite: z.boolean().optional().nullable(),
  privateNote: z.string().trim().max(500).optional().nullable(),
  shareIdentityWithOrganizer: z.boolean().default(false),
});

export const clearRecipePreferenceSchema = z.object({
  householdId: z.string().uuid(),
  recipeId: z.string().uuid(),
});

export const submitRecipeFeedbackSchema = z.object({
  householdId: z.string().uuid(),
  feedbackRequestId: z.string().uuid(),
  preferenceSignal: z.enum(PREFERENCE_SIGNALS),
  isFavorite: z.boolean().default(false),
  privateNote: z.string().trim().max(500).optional().nullable(),
  shareIdentityWithOrganizer: z.boolean().default(false),
});

export const dismissRecipeFeedbackSchema = z.object({
  householdId: z.string().uuid(),
  feedbackRequestId: z.string().uuid(),
});

export const recalculateMealRecommendationSchema = z.object({
  householdId: z.string().uuid(),
  mealRequestId: z.string().uuid(),
});

export const preferenceFitSummarySchema = z.enum(PREFERENCE_FIT_SUMMARIES);

export const respondMealSchema = z.object({
  householdId: z.string().uuid(),
  mealPlanId: z.string().uuid(),
  status: z.enum(["going", "maybe", "not_going", "no_response"]),
  guestCount: z.coerce.number().int().min(0).max(20).default(0),
});

export const confirmShoppingPrepSchema = z.object({
  householdId: z.string().uuid(),
  proposalId: z.string().uuid(),
  excludedLineIdsJson: z.string().default("[]"),
});

export const mealSettingsSchema = z.object({
  householdId: z.string().uuid(),
  assumeStaplesAvailable: z.boolean().default(false),
  shoppingPrepPolicy: z.enum([
    "manual",
    "suggest_and_confirm",
    "automatic_on_acceptance",
  ]),
});

export const markPreparedSchema = z.object({
  householdId: z.string().uuid(),
  mealPlanId: z.string().uuid(),
  createBatch: z.boolean().default(true),
  remainingState: z
    .enum(["plenty", "about_half", "low", "finished", "unknown"])
    .default("plenty"),
});

export const updateBatchRemainingSchema = z.object({
  householdId: z.string().uuid(),
  batchId: z.string().uuid(),
  remainingState: z.enum([
    "plenty",
    "about_half",
    "low",
    "finished",
    "unknown",
  ]),
});
