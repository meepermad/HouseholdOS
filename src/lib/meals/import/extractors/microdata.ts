import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { AnyNode, Element } from "domhandler";
import type { ExtractorHit, RawExtractedRecipe } from "../types";
import { filterCopyrightFields } from "../copyright-filter";

const RECIPE_ITEMTYPES = [
  "https://schema.org/Recipe",
  "http://schema.org/Recipe",
  "https://schema.org/recipe",
  "http://schema.org/recipe",
];

/**
 * Microdata / limited RDFa Recipe extraction — well-known fields only.
 */
export function extractMicrodata(html: string): ExtractorHit[] {
  const $ = cheerio.load(html);
  const hits: ExtractorHit[] = [];

  // Microdata itemscope
  $("[itemscope]").each((_, el) => {
    const itemtype = ($(el).attr("itemtype") ?? "").trim();
    if (!isRecipeItemType(itemtype)) return;
    const raw = readMicrodataRecipe($, el);
    if (!hasMinimalRecipe(raw)) return;
    const { filtered, droppedFields } = filterCopyrightFields(raw);
    hits.push({
      strategy: "microdata",
      raw: filtered,
      label: typeof filtered.name === "string" ? filtered.name : "Microdata recipe",
      confidence: {
        level: "needs_review",
        reason: "Microdata Recipe (limited fields)",
      },
      warnings: [
        {
          code: "microdata_limited",
          message: "Extracted via microdata — verify fields",
          severity: "info",
        },
        ...(droppedFields.length
          ? [
              {
                code: "field_dropped_copyright" as const,
                message: `Dropped fields: ${droppedFields.slice(0, 6).join(", ")}`,
                severity: "info" as const,
              },
            ]
          : []),
      ],
    });
  });

  // RDFa typeof="schema:Recipe" / "Recipe"
  $("[typeof]").each((_, el) => {
    const typeofAttr = ($(el).attr("typeof") ?? "").toLowerCase();
    if (!/\brecipe\b/.test(typeofAttr) && !typeofAttr.includes("schema:recipe")) {
      return;
    }
    // Skip if already captured as microdata on same node
    if ($(el).attr("itemscope") != null && isRecipeItemType($(el).attr("itemtype") ?? "")) {
      return;
    }
    const raw = readRdfaRecipe($, el);
    if (!hasMinimalRecipe(raw)) return;
    const { filtered } = filterCopyrightFields(raw);
    hits.push({
      strategy: "microdata",
      raw: filtered,
      label: typeof filtered.name === "string" ? filtered.name : "RDFa recipe",
      confidence: {
        level: "needs_review",
        reason: "RDFa Recipe (limited fields)",
      },
      warnings: [
        {
          code: "microdata_limited",
          message: "Extracted via RDFa — verify fields",
          severity: "info",
        },
      ],
    });
  });

  return dedupeHits(hits);
}

function isRecipeItemType(itemtype: string): boolean {
  const lower = itemtype.toLowerCase();
  return (
    RECIPE_ITEMTYPES.some((t) => t.toLowerCase() === lower) ||
    /(^|\s)https?:\/\/schema\.org\/recipe(\s|$)/i.test(itemtype)
  );
}

function readMicrodataRecipe($: CheerioAPI, root: Element): RawExtractedRecipe {
  const raw: RawExtractedRecipe = { "@type": "Recipe" };

  const prop = (name: string): string[] => {
    const values: string[] = [];
    $(root)
      .find(`[itemprop="${name}"]`)
      .each((_, el) => {
        // Avoid nested itemscopes' props for non-list fields — still OK for ingredients
        const content =
          $(el).attr("content") ||
          $(el).attr("datetime") ||
          textOf($, el);
        const t = content.trim();
        if (t) values.push(t);
      });
    return values;
  };

  const name = prop("name")[0];
  if (name) raw.name = name;

  const description = prop("description")[0];
  if (description) raw.description = description;

  const ingredients = prop("recipeIngredient");
  if (ingredients.length) raw.recipeIngredient = ingredients;
  else {
    const alt = prop("ingredients");
    if (alt.length) raw.ingredients = alt;
  }

  const instructions = collectInstructions($, root);
  if (instructions.length === 1) raw.recipeInstructions = instructions[0];
  else if (instructions.length > 1) raw.recipeInstructions = instructions;

  const yieldVal = prop("recipeYield")[0] ?? prop("yield")[0];
  if (yieldVal) raw.recipeYield = yieldVal;

  for (const t of ["prepTime", "cookTime", "totalTime"] as const) {
    const v = prop(t)[0];
    if (v) raw[t] = v;
  }

  const author = prop("author")[0];
  if (author) raw.author = author;

  const image = firstImage($, root);
  if (image) raw.image = image;

  const category = prop("recipeCategory");
  if (category.length) raw.recipeCategory = category.length === 1 ? category[0] : category;

  const cuisine = prop("recipeCuisine")[0];
  if (cuisine) raw.recipeCuisine = cuisine;

  const keywords = prop("keywords");
  if (keywords.length) raw.keywords = keywords.join(", ");

  return raw;
}

function readRdfaRecipe($: CheerioAPI, root: Element): RawExtractedRecipe {
  const raw: RawExtractedRecipe = { "@type": "Recipe" };

  const prop = (name: string): string[] => {
    const values: string[] = [];
    const selectors = [
      `[property="schema:${name}"]`,
      `[property="${name}"]`,
      `[property="http://schema.org/${name}"]`,
      `[property="https://schema.org/${name}"]`,
    ];
    for (const sel of selectors) {
      $(root)
        .find(sel)
        .each((_, el) => {
          const content =
            $(el).attr("content") ||
            $(el).attr("datetime") ||
            textOf($, el);
          const t = content.trim();
          if (t) values.push(t);
        });
    }
    return values;
  };

  const name = prop("name")[0];
  if (name) raw.name = name;
  const description = prop("description")[0];
  if (description) raw.description = description;
  const ingredients = prop("recipeIngredient");
  if (ingredients.length) raw.recipeIngredient = ingredients;
  const instructions = prop("recipeInstructions");
  if (instructions.length) {
    raw.recipeInstructions =
      instructions.length === 1 ? instructions[0] : instructions;
  }
  const yieldVal = prop("recipeYield")[0];
  if (yieldVal) raw.recipeYield = yieldVal;
  for (const t of ["prepTime", "cookTime", "totalTime"] as const) {
    const v = prop(t)[0];
    if (v) raw[t] = v;
  }
  return raw;
}

function collectInstructions($: CheerioAPI, root: Element): string[] {
  const out: string[] = [];
  $(root)
    .find('[itemprop="recipeInstructions"], [itemprop="instructions"]')
    .each((_, el) => {
      const itemtype = ($(el).attr("itemtype") ?? "").toLowerCase();
      if (itemtype.includes("howtosection")) {
        const sectionName =
          $(el).find('[itemprop="name"]').first().text().trim() || null;
        $(el)
          .find('[itemprop="itemListElement"] [itemprop="text"], [itemprop="text"]')
          .each((__, step) => {
            const t = textOf($, step).trim();
            if (t) out.push(sectionName ? `${sectionName}: ${t}` : t);
          });
        return;
      }
      const t =
        $(el).attr("content") ||
        $(el).find('[itemprop="text"]').first().text() ||
        textOf($, el);
      const cleaned = t.trim();
      if (cleaned) out.push(cleaned);
    });
  return out;
}

function firstImage($: CheerioAPI, root: Element): string | null {
  const el = $(root).find('[itemprop="image"]').first();
  if (!el.length) return null;
  return (
    el.attr("content") ||
    el.attr("src") ||
    el.find("img").attr("src") ||
    null
  );
}

function textOf($: CheerioAPI, el: AnyNode): string {
  return $(el).text().replace(/\s+/g, " ").trim();
}

function hasMinimalRecipe(raw: RawExtractedRecipe): boolean {
  const hasName = typeof raw.name === "string" && raw.name.trim().length > 0;
  const ings = raw.recipeIngredient ?? raw.ingredients;
  const hasIngs = Array.isArray(ings)
    ? ings.length > 0
    : typeof ings === "string" && ings.trim().length > 0;
  const hasSteps =
    raw.recipeInstructions != null || raw.instructions != null;
  return hasName || hasIngs || Boolean(hasSteps);
}

function dedupeHits(hits: ExtractorHit[]): ExtractorHit[] {
  const seen = new Set<string>();
  const out: ExtractorHit[] = [];
  for (const hit of hits) {
    const key = JSON.stringify(hit.raw).slice(0, 400);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}
