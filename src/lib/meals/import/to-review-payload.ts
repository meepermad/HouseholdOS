import type { ExtractedRecipeCandidate } from "./types";

/**
 * Shape expected by ImportReviewForm and save_imported_recipe.
 * Uses create_recipe-compatible snake_case ingredient/step keys.
 */
export type ReviewRecipePayload = {
  name: string;
  description: string | null;
  category: string;
  cuisine: string | null;
  baseServings: number;
  yieldText: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  author: string | null;
  imageUrl: string | null;
  datePublished: string | null;
  tags: string[];
  ingredients: Array<{
    original_imported_text: string;
    display_name: string;
    quantity: string | null;
    quantity_unit: string;
    quantity_mode: string;
    preparation_note: string | null;
    ingredient_group: string | null;
    required: boolean;
    parser_confidence: number;
    user_confirmed: boolean;
    originalText?: string;
    confidence?: number;
  }>;
  steps: Array<{
    step_number: number;
    instruction: string;
    section: string | null;
    phase: string;
    duration_minutes: number | null;
  }>;
  equipment: Array<{ display_name: string }>;
};

function confidenceToNumber(level: string): number {
  switch (level) {
    case "confident":
      return 0.9;
    case "needs_review":
      return 0.45;
    case "unsupported":
      return 0.2;
    case "missing":
    default:
      return 0.1;
  }
}

export function candidateToReviewPayload(
  candidate: ExtractedRecipeCandidate,
): ReviewRecipePayload {
  const ingredients = candidate.ingredients
    .filter((ing) => !ing.isSectionHeading)
    .map((ing) => ({
      original_imported_text: ing.originalText,
      originalText: ing.originalText,
      display_name: ing.displayName,
      quantity: ing.quantity != null ? String(ing.quantity) : null,
      quantity_unit: ing.unit,
      quantity_mode: ing.quantityMode,
      preparation_note: ing.preparationNote,
      ingredient_group: ing.ingredientGroup,
      required: ing.required,
      parser_confidence: confidenceToNumber(ing.confidence.level),
      confidence: confidenceToNumber(ing.confidence.level),
      user_confirmed: false,
    }));

  return {
    name: candidate.name?.trim() || "Imported recipe",
    description: candidate.description,
    category: candidate.category ?? "other",
    cuisine: candidate.cuisineLabel,
    baseServings: candidate.baseServings ?? candidate.yield.servings ?? 4,
    yieldText: candidate.yieldText ?? candidate.yield.raw,
    prepMinutes: candidate.prepMinutes,
    cookMinutes: candidate.cookMinutes,
    totalMinutes: candidate.totalMinutes,
    author: candidate.sourceAuthor,
    imageUrl: candidate.sourceImageUrl,
    datePublished: candidate.sourcePublishedAt,
    tags: candidate.tags.slice(0, 20),
    ingredients,
    steps: candidate.steps.map((step) => ({
      step_number: step.stepNumber,
      instruction: step.instruction,
      section: step.section,
      phase: step.phase,
      duration_minutes: step.durationMinutes,
    })),
    equipment: candidate.equipment.map((name) => ({ display_name: name })),
  };
}

export function warningMessages(
  warnings: Array<{ message: string }>,
): string[] {
  return warnings.map((w) => w.message);
}
