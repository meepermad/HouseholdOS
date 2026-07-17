/**
 * Phase 6.6 recipe extraction / normalization types.
 * Practical shapes for review UI, drafts, and create_recipe payloads.
 */

import type { QuantityUnit } from "@/lib/house/types";
import type { QuantityMode, RecipeCategory, RecipeDifficulty } from "../types";

/** Bump when extraction/normalization semantics change (stored on drafts/recipes). */
export const RECIPE_IMPORT_PARSER_VERSION = "6.6.0";

export const EXTRACTION_STRATEGIES = [
  "json_ld",
  "microdata",
  "html_fallback",
  "manual",
] as const;
export type ExtractionStrategy = (typeof EXTRACTION_STRATEGIES)[number];

export const IMPORT_CONFIDENCE_LEVELS = [
  "confident",
  "needs_review",
  "missing",
  "unsupported",
] as const;
export type ImportConfidenceLevel = (typeof IMPORT_CONFIDENCE_LEVELS)[number];

export const IMPORT_WARNING_CODES = [
  "no_recipe_found",
  "multiple_recipes_found",
  "partial_extraction",
  "html_fallback_used",
  "microdata_limited",
  "unparsed_ingredient",
  "ambiguous_ingredient",
  "missing_ingredients",
  "missing_instructions",
  "missing_name",
  "duration_conflict",
  "ambiguous_yield",
  "non_serving_yield",
  "html_stripped",
  "field_dropped_copyright",
  "image_url_untrusted",
  "structured_data_invalid",
] as const;
export type ImportWarningCode = (typeof IMPORT_WARNING_CODES)[number];

export type ImportValidationWarning = {
  code: ImportWarningCode;
  message: string;
  field?: string;
  severity?: "info" | "warn";
};

export type FieldConfidence = {
  level: ImportConfidenceLevel;
  reason?: string;
};

/** Parsed ingredient line ready for review / DB mapping. */
export type ParsedIngredient = {
  /** Original source string (never fabricated). */
  originalText: string;
  displayName: string;
  quantity: number | null;
  quantityMax: number | null;
  unit: QuantityUnit;
  quantityMode: QuantityMode;
  preparationNote: string | null;
  ingredientGroup: string | null;
  required: boolean;
  sortOrder: number;
  confidence: FieldConfidence;
  /** True when line is a section heading, not an ingredient. */
  isSectionHeading?: boolean;
};

export type ParsedInstructionStep = {
  stepNumber: number;
  instruction: string;
  /** Section / HowToSection name; maps to recipe_steps.phase or prefix. */
  section: string | null;
  phase: "preparation" | "cooking" | "finishing" | "other";
  durationMinutes: number | null;
  sortOrder: number;
  confidence: FieldConfidence;
};

export type ParsedDuration = {
  /** Raw source value(s) for review. */
  raw: string | null;
  minutes: number | null;
  confidence: FieldConfidence;
};

export type ParsedYield = {
  /** Always preserve source yield text when present. */
  raw: string | null;
  /** Numeric servings when clearly people/servings/portions. */
  servings: number | null;
  /** cookies, loaves, pieces, etc. — not auto-treated as people. */
  yieldKind: "servings" | "pieces" | "other" | "unknown";
  confidence: FieldConfidence;
};

/** Normalized cooking-only recipe candidate from extractors + parsers. */
export type ExtractedRecipeCandidate = {
  name: string | null;
  description: string | null;
  category: RecipeCategory | null;
  cuisineLabel: string | null;
  tags: string[];
  ingredients: ParsedIngredient[];
  steps: ParsedInstructionStep[];
  equipment: string[];
  baseServings: number | null;
  yieldText: string | null;
  yield: ParsedYield;
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  difficulty: RecipeDifficulty | null;
  sourceAuthor: string | null;
  sourcePublishedAt: string | null;
  sourceImageUrl: string | null;
  sourceTitle: string | null;
  keywords: string[];
  confidence: FieldConfidence;
  fieldConfidence: {
    name: FieldConfidence;
    ingredients: FieldConfidence;
    instructions: FieldConfidence;
    yield: FieldConfidence;
    times: FieldConfidence;
  };
  warnings: ImportValidationWarning[];
};

export type RawExtractedRecipe = {
  name?: unknown;
  description?: unknown;
  recipeIngredient?: unknown;
  ingredients?: unknown;
  recipeInstructions?: unknown;
  instructions?: unknown;
  recipeYield?: unknown;
  yield?: unknown;
  prepTime?: unknown;
  cookTime?: unknown;
  totalTime?: unknown;
  author?: unknown;
  datePublished?: unknown;
  image?: unknown;
  keywords?: unknown;
  recipeCategory?: unknown;
  recipeCuisine?: unknown;
  suitableForDiet?: unknown;
  tool?: unknown;
  recipeTool?: unknown;
  url?: unknown;
  /** Free-form extras from structured data (filtered later). */
  [key: string]: unknown;
};

export type ExtractorHit = {
  strategy: ExtractionStrategy;
  raw: RawExtractedRecipe;
  /** Source label for multi-candidate UI. */
  label?: string;
  confidence: FieldConfidence;
  warnings: ImportValidationWarning[];
};

export type ConfidenceSummary = {
  overall: ImportConfidenceLevel;
  name: ImportConfidenceLevel;
  ingredients: ImportConfidenceLevel;
  instructions: ImportConfidenceLevel;
  yield: ImportConfidenceLevel;
  times: ImportConfidenceLevel;
  candidateCount: number;
};

export type RecipeImportPipelineInput = {
  html: string;
  sourceUrl: string;
  /** Optional final URL after redirects. */
  finalUrl?: string | null;
};

export type RecipeImportPipelineResult = {
  strategy: ExtractionStrategy | null;
  candidates: ExtractedRecipeCandidate[];
  /** Primary / first candidate (null when none). */
  primary: ExtractedRecipeCandidate | null;
  warnings: ImportValidationWarning[];
  confidence: ConfidenceSummary;
  contentHash: string | null;
  canonicalUrl: string;
  sourceHostname: string;
  parserVersion: string;
};

export type ExistingRecipeDuplicateProbe = {
  id: string;
  name: string;
  sourceCanonicalUrl?: string | null;
  importedContentHash?: string | null;
  ingredientNames?: readonly string[];
};

export type DuplicateMatchKind = "exact_source" | "exact_hash" | "similar_content";

export type DuplicateMatch = {
  recipeId: string;
  kind: DuplicateMatchKind;
  score: number;
  reason: string;
};

export type DuplicateDetectionResult = {
  matches: DuplicateMatch[];
  hasExact: boolean;
};
