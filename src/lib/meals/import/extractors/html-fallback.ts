import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { ExtractorHit, RawExtractedRecipe } from "../types";

/**
 * Conservative HTML fallback when JSON-LD / microdata are absent.
 * Title + ingredient-looking lists + ordered steps + yield/times heuristics.
 * Always lower confidence with warnings.
 */
export function extractHtmlFallback(html: string): ExtractorHit[] {
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe, svg, nav, footer, header, aside").remove();

  const name =
    $("h1").first().text().trim() ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").first().text().trim() ||
    null;

  const ingredients = findIngredientLines($);
  const instructions = findInstructionLines($);
  const yieldText = findLabeledValue($, [
    "yield",
    "servings",
    "serves",
    "makes",
  ]);
  const prepTime = findLabeledValue($, ["prep time", "prep", "preparation"]);
  const cookTime = findLabeledValue($, ["cook time", "cook", "baking time"]);
  const totalTime = findLabeledValue($, ["total time", "total", "ready in"]);

  if (!name && ingredients.length === 0 && instructions.length === 0) {
    return [];
  }

  const raw: RawExtractedRecipe = {
    "@type": "Recipe",
    name: name ?? undefined,
    recipeIngredient: ingredients.length ? ingredients : undefined,
    recipeInstructions: instructions.length ? instructions : undefined,
    recipeYield: yieldText ?? undefined,
    prepTime: prepTime ?? undefined,
    cookTime: cookTime ?? undefined,
    totalTime: totalTime ?? undefined,
  };

  const image =
    $('meta[property="og:image"]').attr("content") ||
    $("article img, .recipe img, main img").first().attr("src") ||
    null;
  if (image) raw.image = image;

  return [
    {
      strategy: "html_fallback",
      raw,
      label: name ?? "HTML fallback recipe",
      confidence: {
        level: "needs_review",
        reason: "Conservative HTML fallback",
      },
      warnings: [
        {
          code: "html_fallback_used",
          message:
            "Structured data missing — used conservative HTML heuristics; review carefully",
          severity: "warn",
        },
        {
          code: "partial_extraction",
          message: "HTML fallback may miss or mis-group fields",
          severity: "info",
        },
      ],
    },
  ];
}

function findIngredientLines($: CheerioAPI): string[] {
  const lines: string[] = [];

  const classIdLists = $(
    "ul, ol",
  ).filter((_, el) => {
    const classId = `${$(el).attr("class") ?? ""} ${$(el).attr("id") ?? ""}`.toLowerCase();
    return classId.includes("ingredient");
  });

  classIdLists.find("li").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t && t.length < 300) lines.push(t);
  });

  $(".ingredients li, #ingredients li").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t && t.length < 300) lines.push(t);
  });

  if (lines.length >= 2) return unique(lines);

  // Heuristic: ul/ol whose items look like quantities
  $("ul, ol").each((_, list) => {
    if (lines.length >= 3) return;
    const items = $(list)
      .children("li")
      .map((__, li) => $(li).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean);
    if (items.length < 3 || items.length > 40) return;
    const qtyLike = items.filter((t) =>
      /^(\d|½|⅓|¼|¾|[\d./]+\s)/.test(t),
    ).length;
    if (qtyLike / items.length >= 0.5) {
      lines.push(...items);
    }
  });

  return unique(lines).slice(0, 60);
}

function findInstructionLines($: CheerioAPI): string[] {
  const lines: string[] = [];

  const classIdLists = $("ul, ol").filter((_, el) => {
    const classId = `${$(el).attr("class") ?? ""} ${$(el).attr("id") ?? ""}`.toLowerCase();
    return (
      classId.includes("instruction") ||
      classId.includes("direction") ||
      classId.includes("method") ||
      classId.includes("recipe")
    );
  });

  classIdLists.children("li").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t && t.length > 5 && t.length < 4000) lines.push(t);
  });

  $(".instructions li, .directions li").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t && t.length > 5 && t.length < 4000) lines.push(t);
  });

  if (lines.length >= 2) return unique(lines);

  // First long ordered list in main/article
  $("article ol, main ol, .recipe ol, ol").each((_, list) => {
    if (lines.length >= 2) return;
    const items = $(list)
      .children("li")
      .map((__, li) => $(li).text().replace(/\s+/g, " ").trim())
      .get()
      .filter((t) => t.length > 12);
    if (items.length >= 2 && items.length <= 40) {
      lines.push(...items);
    }
  });

  return unique(lines).slice(0, 40);
}

function findLabeledValue($: CheerioAPI, labels: string[]): string | null {
  let fromDt: string | null = null;
  $("dt").each((_, dt) => {
    if (fromDt) return;
    const label = $(dt).text().trim().toLowerCase();
    if (!labels.some((l) => label.includes(l))) return;
    const dd = $(dt).next("dd").text().replace(/\s+/g, " ").trim();
    if (dd) fromDt = dd;
  });
  if (fromDt) return fromDt;

  const bodyText = $("body").text();
  for (const label of labels) {
    const re = new RegExp(
      `${escapeRegExp(label)}\\s*[:\\-]?\\s*([^\\n]{1,40})`,
      "i",
    );
    const m = bodyText.match(re);
    if (m?.[1]) {
      const v = m[1].replace(/\s+/g, " ").trim();
      if (v.length > 0 && v.length < 40) return v;
    }
  }
  return null;
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of items) {
    const k = i.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(i);
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
