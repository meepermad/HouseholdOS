import * as cheerio from "cheerio";
import type { ExtractorHit, RawExtractedRecipe } from "../types";
import { filterCopyrightFields } from "../copyright-filter";

const RECIPE_TYPES = new Set([
  "recipe",
  "http://schema.org/recipe",
  "https://schema.org/recipe",
]);

/**
 * Layered JSON-LD extraction: object, arrays, @graph, nested Recipe,
 * multiple candidates.
 */
export function extractJsonLd(html: string): ExtractorHit[] {
  const $ = cheerio.load(html);
  const recipes: RawExtractedRecipe[] = [];
  const seen = new Set<string>();

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html() ?? $(el).text();
    if (!raw?.trim()) return;
    const parsed = safeJsonParse(raw);
    if (parsed == null) return;
    collectRecipes(parsed, recipes, seen, 0);
  });

  return recipes.map((raw, index) => {
    const { filtered, droppedFields } = filterCopyrightFields(raw);
    return {
      strategy: "json_ld" as const,
      raw: filtered,
      label: pickLabel(filtered, index),
      confidence: {
        level: "confident" as const,
        reason: "JSON-LD Recipe",
      },
      warnings:
        droppedFields.length > 0
          ? [
              {
                code: "field_dropped_copyright" as const,
                message: `Dropped non-cooking fields: ${droppedFields.slice(0, 8).join(", ")}`,
                severity: "info" as const,
              },
            ]
          : [],
    };
  });
}

function collectRecipes(
  node: unknown,
  out: RawExtractedRecipe[],
  seen: Set<string>,
  depth: number,
): void {
  if (node == null || depth > 8) return;

  if (Array.isArray(node)) {
    for (const item of node) collectRecipes(item, out, seen, depth + 1);
    return;
  }

  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;

  if (Array.isArray(obj["@graph"])) {
    collectRecipes(obj["@graph"], out, seen, depth + 1);
  }

  if (isRecipeType(obj["@type"])) {
    pushUnique(obj as RawExtractedRecipe, out, seen);
  }

  // Nested mainEntity / hasPart / about
  for (const key of ["mainEntity", "mainEntityOfPage", "hasPart", "about", "item"]) {
    if (obj[key] != null) collectRecipes(obj[key], out, seen, depth + 1);
  }

  // Some pages wrap recipes under @graph-like custom keys — scan shallow values
  if (depth < 3) {
    for (const value of Object.values(obj)) {
      if (value && typeof value === "object") {
        const v = value as Record<string, unknown>;
        if (isRecipeType(v["@type"]) || Array.isArray(v["@graph"])) {
          collectRecipes(value, out, seen, depth + 1);
        }
      }
    }
  }
}

function isRecipeType(typeValue: unknown): boolean {
  const types = Array.isArray(typeValue)
    ? typeValue
    : typeValue != null
      ? [typeValue]
      : [];
  return types.some(
    (t) => typeof t === "string" && RECIPE_TYPES.has(t.trim().toLowerCase()),
  );
}

function pushUnique(
  recipe: RawExtractedRecipe,
  out: RawExtractedRecipe[],
  seen: Set<string>,
): void {
  const key = fingerprint(recipe);
  if (seen.has(key)) return;
  seen.add(key);
  out.push(recipe);
}

function fingerprint(recipe: RawExtractedRecipe): string {
  const name = String(recipe.name ?? recipe.headline ?? "");
  const ings = JSON.stringify(
    recipe.recipeIngredient ?? recipe.ingredients ?? "",
  );
  return `${name}::${ings}`.toLowerCase().slice(0, 500);
}

function pickLabel(raw: RawExtractedRecipe, index: number): string {
  const name = raw.name ?? raw.headline;
  if (typeof name === "string" && name.trim()) return name.trim().slice(0, 120);
  return `Recipe ${index + 1}`;
}

function safeJsonParse(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Common: trailing commas or multiple JSON objects concatenated
    try {
      const fixed = trimmed
        .replace(/,\s*([\]}])/g, "$1")
        .replace(/^\uFEFF/, "");
      return JSON.parse(fixed);
    } catch {
      // NDJSON / multiple root objects
      try {
        const wrapped = `[${trimmed.replace(/}\s*{/g, "},{")}]`;
        return JSON.parse(wrapped);
      } catch {
        return null;
      }
    }
  }
}
