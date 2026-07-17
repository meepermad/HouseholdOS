import type { RawExtractedRecipe } from "./types";

/**
 * Cooking-relevant schema.org / common recipe fields only.
 * Drop article body, comments, ads, and unrelated marketing blobs.
 */
export const COPYRIGHT_SAFE_RECIPE_FIELDS = [
  "name",
  "headline",
  "description",
  "recipeIngredient",
  "ingredients",
  "recipeInstructions",
  "instructions",
  "recipeYield",
  "yield",
  "prepTime",
  "cookTime",
  "totalTime",
  "author",
  "datePublished",
  "image",
  "keywords",
  "recipeCategory",
  "recipeCuisine",
  "suitableForDiet",
  "tool",
  "recipeTool",
  "nutrition",
  "cookingMethod",
  "recipeDifficulty",
  "url",
  "@type",
  "@id",
] as const;

const SAFE_SET = new Set<string>(COPYRIGHT_SAFE_RECIPE_FIELDS);

const DROP_FIELD_HINTS =
  /comment|articlebody|article|mainentityofpage|publisher|ispartof|speakable|interaction|aggregate.?rating|review|video|transcript|breadcrumb|potentialaction|offers|sku|gtin|brand|advert|sidebar|related|social|share/i;

/**
 * Keep only cooking fields from a raw extracted object.
 * Does not copy nested article/HTML bodies.
 */
export function filterCopyrightFields(
  raw: RawExtractedRecipe | Record<string, unknown>,
): {
  filtered: RawExtractedRecipe;
  droppedFields: string[];
} {
  const filtered: RawExtractedRecipe = {};
  const droppedFields: string[] = [];

  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith("@") && key !== "@type" && key !== "@id") {
      droppedFields.push(key);
      continue;
    }
    if (DROP_FIELD_HINTS.test(key) && !SAFE_SET.has(key)) {
      droppedFields.push(key);
      continue;
    }
    if (!SAFE_SET.has(key)) {
      droppedFields.push(key);
      continue;
    }
    if (value == null) continue;

    // Never keep huge HTML blobs in description/name
    if (
      (key === "description" || key === "name" || key === "headline") &&
      typeof value === "string" &&
      value.length > 8000
    ) {
      filtered[key] = value.slice(0, 8000);
      droppedFields.push(`${key}:truncated`);
      continue;
    }

    filtered[key] = value;
  }

  // Prefer name from headline if name missing
  if (!filtered.name && filtered.headline != null) {
    filtered.name = filtered.headline;
  }

  return { filtered, droppedFields };
}
