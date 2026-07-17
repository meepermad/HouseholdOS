import type { RecipeCategory, RecipeDifficulty } from "../types";
import { RECIPE_CATEGORIES } from "../types";
import { filterCopyrightFields } from "./copyright-filter";
import {
  computeContentHash,
  hostnameFromUrl,
  normalizeCanonicalUrl,
} from "./duplicates";
import { extractHtmlFallback } from "./extractors/html-fallback";
import { extractJsonLd } from "./extractors/json-ld";
import { extractMicrodata } from "./extractors/microdata";
import { durationConflictWarning, parseDuration } from "./parse-duration";
import { parseIngredientLines } from "./parse-ingredient";
import {
  instructionsConfidence,
  parseInstructions,
} from "./parse-instructions";
import { parseYield } from "./parse-yield";
import { stripHtml, stripHtmlList } from "./sanitize-html";
import type {
  ConfidenceSummary,
  ExtractedRecipeCandidate,
  ExtractorHit,
  FieldConfidence,
  ImportConfidenceLevel,
  ImportValidationWarning,
  RawExtractedRecipe,
  RecipeImportPipelineInput,
  RecipeImportPipelineResult,
} from "./types";
import { RECIPE_IMPORT_PARSER_VERSION } from "./types";

/**
 * Layered extraction pipeline: JSON-LD → microdata/RDFa → HTML fallback.
 * Yields normalized candidates, strategy, warnings, confidence, and content hash.
 */
export function runRecipeImportPipeline(
  input: RecipeImportPipelineInput,
): RecipeImportPipelineResult {
  const sourceUrl = input.sourceUrl.trim();
  const finalUrl = (input.finalUrl ?? sourceUrl).trim();
  const canonicalUrl = normalizeCanonicalUrl(finalUrl || sourceUrl);
  const sourceHostname = hostnameFromUrl(canonicalUrl) || hostnameFromUrl(sourceUrl);

  const warnings: ImportValidationWarning[] = [];
  let hits: ExtractorHit[] = extractJsonLd(input.html);
  let strategy: RecipeImportPipelineResult["strategy"] = hits.length
    ? "json_ld"
    : null;

  if (hits.length === 0) {
    hits = extractMicrodata(input.html);
    if (hits.length) strategy = "microdata";
  }

  if (hits.length === 0) {
    hits = extractHtmlFallback(input.html);
    if (hits.length) strategy = "html_fallback";
  }

  if (hits.length === 0) {
    warnings.push({
      code: "no_recipe_found",
      message: "No recipe found in page HTML",
      severity: "warn",
    });
    return {
      strategy: null,
      candidates: [],
      primary: null,
      warnings,
      confidence: emptyConfidence(0),
      contentHash: null,
      canonicalUrl,
      sourceHostname,
      parserVersion: RECIPE_IMPORT_PARSER_VERSION,
    };
  }

  if (hits.length > 1) {
    warnings.push({
      code: "multiple_recipes_found",
      message: `Found ${hits.length} recipe candidates — select one to continue`,
      severity: "info",
    });
  }

  const candidates = hits.map((hit) => normalizeExtractorHit(hit));
  for (const c of candidates) {
    warnings.push(...c.warnings);
  }

  const primary = candidates[0] ?? null;
  const contentHash = primary ? computeContentHash(primary) : null;
  const confidence = summarizeConfidence(candidates);

  return {
    strategy,
    candidates,
    primary,
    warnings: dedupeWarnings(warnings),
    confidence,
    contentHash,
    canonicalUrl,
    sourceHostname,
    parserVersion: RECIPE_IMPORT_PARSER_VERSION,
  };
}

/** Normalize a single raw extractor hit into a review-ready candidate. */
export function normalizeExtractorHit(
  hit: ExtractorHit,
): ExtractedRecipeCandidate {
  const { filtered } = filterCopyrightFields(hit.raw);
  return normalizeRawRecipe(filtered, hit);
}

export function normalizeRawRecipe(
  raw: RawExtractedRecipe,
  hit?: Pick<ExtractorHit, "strategy" | "confidence" | "warnings">,
): ExtractedRecipeCandidate {
  const warnings: ImportValidationWarning[] = [...(hit?.warnings ?? [])];

  const name = stripHtml(raw.name ?? raw.headline) || null;
  const description = stripHtml(raw.description) || null;

  const ingredientLines = coerceStringList(
    raw.recipeIngredient ?? raw.ingredients,
  );
  const ingredients = parseIngredientLines(ingredientLines);
  if (ingredients.length === 0) {
    warnings.push({
      code: "missing_ingredients",
      message: "No ingredients extracted",
      field: "ingredients",
      severity: "warn",
    });
  } else {
    const shaky = ingredients.filter(
      (i) => i.confidence.level === "needs_review",
    ).length;
    if (shaky > 0) {
      warnings.push({
        code: "ambiguous_ingredient",
        message: `${shaky} ingredient line(s) need review`,
        field: "ingredients",
        severity: "info",
      });
    }
  }

  const steps = parseInstructions(
    raw.recipeInstructions ?? raw.instructions,
  );
  if (steps.length === 0) {
    warnings.push({
      code: "missing_instructions",
      message: "No instructions extracted",
      field: "instructions",
      severity: "warn",
    });
  }

  const yieldParsed = parseYield(raw.recipeYield ?? raw.yield);
  if (yieldParsed.yieldKind === "pieces") {
    warnings.push({
      code: "non_serving_yield",
      message: "Yield appears to be pieces/baked goods, not people servings",
      field: "yield",
      severity: "info",
    });
  } else if (
    yieldParsed.confidence.level === "needs_review" &&
    yieldParsed.raw
  ) {
    warnings.push({
      code: "ambiguous_yield",
      message: "Yield needs review",
      field: "yield",
      severity: "info",
    });
  }

  const prep = parseDuration(raw.prepTime);
  const cook = parseDuration(raw.cookTime);
  const total = parseDuration(raw.totalTime);
  if (
    durationConflictWarning(prep.minutes, cook.minutes, total.minutes)
  ) {
    warnings.push({
      code: "duration_conflict",
      message: "Total time does not equal prep + cook",
      field: "times",
      severity: "warn",
    });
  }

  const equipment = coerceStringList(raw.tool ?? raw.recipeTool).map((t) =>
    stripHtml(t),
  );

  const tags = [
    ...coerceStringList(raw.keywords).flatMap((k) =>
      k.split(/[,;]/).map((x) => stripHtml(x)).filter(Boolean),
    ),
    ...coerceStringList(raw.recipeCategory).map((c) => stripHtml(c)),
  ].filter(Boolean);

  const cuisineLabel =
    stripHtml(
      Array.isArray(raw.recipeCuisine)
        ? raw.recipeCuisine[0]
        : raw.recipeCuisine,
    ) || null;

  const category = mapCategory(raw.recipeCategory);
  const difficulty = mapDifficulty(raw.recipeDifficulty);

  const author = extractAuthor(raw.author);
  const imageUrl = extractImageUrl(raw.image);
  const published = stripHtml(raw.datePublished) || null;

  if (!name) {
    warnings.push({
      code: "missing_name",
      message: "Recipe name missing",
      field: "name",
      severity: "warn",
    });
  }

  const fieldConfidence = {
    name: (name
      ? { level: "confident" as const, reason: "Name present" }
      : { level: "missing" as const, reason: "Name missing" }) satisfies FieldConfidence,
    ingredients: ingredientsConfidence(ingredients.length, warnings),
    instructions: instructionsConfidence(steps),
    yield: yieldParsed.confidence,
    times: timesConfidence(prep, cook, total),
  };

  const overall = worstConfidence([
    fieldConfidence.name,
    fieldConfidence.ingredients,
    fieldConfidence.instructions,
    hit?.confidence ?? { level: "needs_review" },
  ]);

  return {
    name,
    description,
    category,
    cuisineLabel,
    tags: uniqueStrings(tags).slice(0, 30),
    ingredients,
    steps,
    equipment: uniqueStrings(equipment).slice(0, 30),
    baseServings: yieldParsed.servings,
    yieldText: yieldParsed.raw,
    yield: yieldParsed,
    prepMinutes: prep.minutes,
    cookMinutes: cook.minutes,
    totalMinutes:
      total.minutes ??
      (prep.minutes != null || cook.minutes != null
        ? (prep.minutes ?? 0) + (cook.minutes ?? 0)
        : null),
    difficulty,
    sourceAuthor: author,
    sourcePublishedAt: published,
    sourceImageUrl: imageUrl,
    sourceTitle: name,
    keywords: uniqueStrings(tags).slice(0, 30),
    confidence: overall,
    fieldConfidence,
    warnings: dedupeWarnings(warnings),
  };
}

function coerceStringList(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string") {
    // Sometimes ingredients are a single newline-separated string
    if (value.includes("\n")) {
      return value
        .split(/\n+/)
        .map((s) => stripHtml(s))
        .filter(Boolean);
    }
    return [stripHtml(value)].filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.flatMap((v) => {
      if (typeof v === "string" || typeof v === "number") {
        return [stripHtml(v)].filter(Boolean);
      }
      if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        const t = stripHtml(o.text ?? o.name ?? o["@value"]);
        return t ? [t] : [];
      }
      return [];
    });
  }
  if (typeof value === "object") {
    return stripHtmlList([value]);
  }
  return [];
}

function extractAuthor(author: unknown): string | null {
  if (author == null) return null;
  if (typeof author === "string") return stripHtml(author) || null;
  if (Array.isArray(author)) {
    return extractAuthor(author[0]);
  }
  if (typeof author === "object") {
    const o = author as Record<string, unknown>;
    return stripHtml(o.name ?? o["@value"]) || null;
  }
  return null;
}

function extractImageUrl(image: unknown): string | null {
  if (image == null) return null;
  if (typeof image === "string") {
    const t = image.trim();
    return t.startsWith("http") ? t.slice(0, 2000) : null;
  }
  if (Array.isArray(image)) return extractImageUrl(image[0]);
  if (typeof image === "object") {
    const o = image as Record<string, unknown>;
    return extractImageUrl(o.url ?? o.contentUrl ?? o["@id"]);
  }
  return null;
}

function mapCategory(value: unknown): RecipeCategory | null {
  const raw = stripHtml(
    Array.isArray(value) ? value[0] : value,
  ).toLowerCase();
  if (!raw) return null;
  for (const cat of RECIPE_CATEGORIES) {
    if (raw.includes(cat.replace(/_/g, " ")) || raw.includes(cat)) {
      return cat;
    }
  }
  if (/breakfast|brunch/.test(raw)) return "breakfast";
  if (/lunch/.test(raw)) return "lunch";
  if (/dinner|supper|entree|main/.test(raw)) return "dinner";
  if (/dessert|cake|cookie|pie|sweet/.test(raw)) return "dessert";
  if (/snack/.test(raw)) return "snack";
  if (/salad/.test(raw)) return "salad";
  if (/soup|stew|chili/.test(raw)) return "soup_stew";
  if (/pasta|noodle/.test(raw)) return "pasta";
  if (/grill|bbq/.test(raw)) return "grill";
  if (/bake|bread/.test(raw)) return "baked";
  if (/side/.test(raw)) return "side";
  return "other";
}

function mapDifficulty(value: unknown): RecipeDifficulty | null {
  const raw = stripHtml(value).toLowerCase();
  if (!raw) return null;
  if (/easy|beginner|simple/.test(raw)) return "easy";
  if (/hard|difficult|advanced|complex/.test(raw)) return "hard";
  if (/medium|intermediate|moderate/.test(raw)) return "medium";
  return "unknown";
}

function ingredientsConfidence(
  count: number,
  warnings: ImportValidationWarning[],
): FieldConfidence {
  if (count === 0) {
    return { level: "missing", reason: "No ingredients" };
  }
  if (warnings.some((w) => w.code === "ambiguous_ingredient")) {
    return { level: "needs_review", reason: "Some ingredients ambiguous" };
  }
  return { level: "confident", reason: `${count} ingredients` };
}

function timesConfidence(
  prep: { minutes: number | null; confidence: FieldConfidence },
  cook: { minutes: number | null; confidence: FieldConfidence },
  total: { minutes: number | null; confidence: FieldConfidence },
): FieldConfidence {
  if (prep.minutes == null && cook.minutes == null && total.minutes == null) {
    return { level: "missing", reason: "No times" };
  }
  return worstConfidence([prep.confidence, cook.confidence, total.confidence]);
}

function worstConfidence(list: FieldConfidence[]): FieldConfidence {
  const order: ImportConfidenceLevel[] = [
    "missing",
    "unsupported",
    "needs_review",
    "confident",
  ];
  let worst: FieldConfidence = { level: "confident" };
  for (const c of list) {
    if (order.indexOf(c.level) < order.indexOf(worst.level)) {
      worst = c;
    }
  }
  return worst;
}

function summarizeConfidence(
  candidates: ExtractedRecipeCandidate[],
): ConfidenceSummary {
  const primary = candidates[0];
  if (!primary) return emptyConfidence(0);
  return {
    overall: primary.confidence.level,
    name: primary.fieldConfidence.name.level,
    ingredients: primary.fieldConfidence.ingredients.level,
    instructions: primary.fieldConfidence.instructions.level,
    yield: primary.fieldConfidence.yield.level,
    times: primary.fieldConfidence.times.level,
    candidateCount: candidates.length,
  };
}

function emptyConfidence(count: number): ConfidenceSummary {
  return {
    overall: "missing",
    name: "missing",
    ingredients: "missing",
    instructions: "missing",
    yield: "missing",
    times: "missing",
    candidateCount: count,
  };
}

function dedupeWarnings(
  warnings: ImportValidationWarning[],
): ImportValidationWarning[] {
  const seen = new Set<string>();
  const out: ImportValidationWarning[] = [];
  for (const w of warnings) {
    const key = `${w.code}:${w.field ?? ""}:${w.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of items) {
    const t = i.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}
