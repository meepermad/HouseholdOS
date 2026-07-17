import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  computeContentHash,
  detectDuplicates,
  durationConflictWarning,
  filterCopyrightFields,
  normalizeCanonicalUrl,
  parseDuration,
  parseIngredientLine,
  parseYield,
  runRecipeImportPipeline,
} from "@/lib/meals/import";

const fixturesDir = path.join(process.cwd(), "tests/fixtures/recipes");

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), "utf8");
}

describe("runRecipeImportPipeline fixtures", () => {
  it("json-ld-lemon-pasta: strategy, name, HowToSection order, ingredient nuances", () => {
    const html = loadFixture("json-ld-lemon-pasta.html");
    const result = runRecipeImportPipeline({
      html,
      sourceUrl: "https://fixtures.example/recipes/lemon-pasta",
    });

    expect(result.strategy).toBe("json_ld");
    expect(result.primary?.name).toBe("Fixture Lemon Pasta");
    expect(result.candidates).toHaveLength(1);

    const steps = result.primary!.steps;
    expect(steps.map((s) => s.section)).toEqual([
      "Pasta",
      "Pasta",
      "Sauce",
      "Sauce",
    ]);
    expect(steps[0]!.instruction).toMatch(/Boil the pasta/i);
    expect(steps[2]!.instruction).toMatch(/Melt butter/i);

    const byOriginal = Object.fromEntries(
      result.primary!.ingredients.map((i) => [i.originalText, i]),
    );

    const flour = byOriginal["1 1/2 cups all-purpose flour"];
    expect(flour?.quantity).toBe(1.5);
    expect(flour?.unit).toBe("cup");
    expect(flour?.displayName.toLowerCase()).toContain("flour");

    const garlic = byOriginal["2–3 cloves garlic, minced"];
    expect(garlic?.quantity).toBe(2);
    expect(garlic?.quantityMax).toBe(3);
    expect(garlic?.unit).toBe("item");
    expect(garlic?.preparationNote?.toLowerCase()).toContain("minced");

    const salt = byOriginal["Salt and pepper, to taste"];
    expect(salt?.quantityMode).toBe("to_taste");

    const parsley = byOriginal["Optional: chopped parsley"];
    expect(parsley?.required).toBe(false);
    expect(parsley?.quantityMode).toBe("optional");

    const butter = byOriginal["2 tablespoons butter"];
    expect(butter?.ingredientGroup).toMatch(/sauce/i);
    expect(butter?.quantity).toBe(2);
    expect(butter?.unit).toBe("tablespoon");

    expect(
      result.primary!.ingredients.some((i) => i.isSectionHeading),
    ).toBe(false);
  });

  it("json-ld-graph-multi: multiple candidates and warning", () => {
    const html = loadFixture("json-ld-graph-multi.html");
    const result = runRecipeImportPipeline({
      html,
      sourceUrl: "https://fixtures.example/recipes/multi",
    });

    expect(result.strategy).toBe("json_ld");
    expect(result.candidates.length).toBeGreaterThanOrEqual(2);
    expect(result.candidates.map((c) => c.name)).toEqual(
      expect.arrayContaining(["Fixture Soup", "Fixture Salad"]),
    );
    expect(result.warnings.some((w) => w.code === "multiple_recipes_found")).toBe(
      true,
    );
    expect(result.confidence.candidateCount).toBeGreaterThanOrEqual(2);
  });

  it("html-fallback-chili: html_fallback with lower confidence and warnings", () => {
    const html = loadFixture("html-fallback-chili.html");
    const result = runRecipeImportPipeline({
      html,
      sourceUrl: "https://fixtures.example/recipes/chili",
    });

    expect(result.strategy).toBe("html_fallback");
    expect(result.primary?.name).toBe("Fixture Fallback Chili");
    expect(result.primary?.ingredients.length).toBeGreaterThanOrEqual(3);
    expect(result.primary?.steps.length).toBeGreaterThanOrEqual(3);
    expect(result.primary?.confidence.level).not.toBe("confident");
    expect(
      result.warnings.some((w) => w.code === "html_fallback_used"),
    ).toBe(true);
    expect(
      result.primary?.steps.some((s) => /must not be imported/i.test(s.instruction)),
    ).toBe(false);
  });
});

describe("parseIngredientLine", () => {
  it("parses mixed fractions and units", () => {
    const line = parseIngredientLine("1 1/2 cups sugar", 0);
    expect(line.quantity).toBe(1.5);
    expect(line.unit).toBe("cup");
    expect(line.displayName.toLowerCase()).toContain("sugar");
  });

  it("parses ranges, to taste, optional, and section headings", () => {
    const range = parseIngredientLine("2-3 teaspoons chili powder", 0);
    expect(range.quantity).toBe(2);
    expect(range.quantityMax).toBe(3);

    const taste = parseIngredientLine("Salt, to taste", 1);
    expect(taste.quantityMode).toBe("to_taste");

    const optional = parseIngredientLine("Optional: cilantro", 2);
    expect(optional.required).toBe(false);
    expect(optional.quantityMode).toBe("optional");

    const heading = parseIngredientLine("For the dressing:", 3);
    expect(heading.isSectionHeading).toBe(true);
    expect(heading.ingredientGroup).toMatch(/dressing/i);
  });
});

describe("parseDuration / parseYield / durationConflictWarning", () => {
  it("parses ISO-8601 and human durations", () => {
    expect(parseDuration("PT1H30M").minutes).toBe(90);
    expect(parseDuration("1 hr 30 min").minutes).toBe(90);
    expect(parseDuration("45 minutes").minutes).toBe(45);
    expect(parseDuration("").minutes).toBeNull();
  });

  it("flags prep+cook vs total conflicts", () => {
    expect(durationConflictWarning(15, 20, 35)).toBe(false);
    expect(durationConflictWarning(15, 20, 40)).toBe(true);
    expect(durationConflictWarning(15, null, 40)).toBe(false);
  });

  it("parses servings and refuses piece yields as people servings", () => {
    const servings = parseYield("4 servings");
    expect(servings.servings).toBe(4);
    expect(servings.yieldKind).toBe("servings");

    const cookies = parseYield("24 cookies");
    expect(cookies.servings).toBeNull();
    expect(cookies.yieldKind).toBe("pieces");
    expect(cookies.raw).toBe("24 cookies");
  });
});

describe("normalizeCanonicalUrl / computeContentHash / detectDuplicates", () => {
  it("strips tracking params and fragments", () => {
    expect(
      normalizeCanonicalUrl(
        "https://Example.com/recipes/pasta/?utm_source=x&fbclid=1&keep=yes#frag",
      ),
    ).toBe("https://example.com/recipes/pasta?keep=yes");
  });

  it("hashes cooking content stably", () => {
    const html = loadFixture("json-ld-lemon-pasta.html");
    const result = runRecipeImportPipeline({
      html,
      sourceUrl: "https://fixtures.example/recipes/lemon-pasta",
    });
    const a = computeContentHash(result.primary!);
    const b = computeContentHash(result.primary!);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(result.contentHash).toBe(a);
  });

  it("detects exact source, exact hash, and similar content", () => {
    const html = loadFixture("json-ld-lemon-pasta.html");
    const result = runRecipeImportPipeline({
      html,
      sourceUrl: "https://fixtures.example/recipes/lemon-pasta",
    });
    const candidate = result.primary!;
    const canonical = result.canonicalUrl;
    const hash = result.contentHash!;

    const exactSource = detectDuplicates(
      { canonicalUrl: canonical, contentHash: hash, name: candidate.name },
      [
        {
          id: "r1",
          name: "Other",
          sourceCanonicalUrl: canonical,
          importedContentHash: null,
          ingredientNames: [],
        },
      ],
    );
    expect(exactSource.hasExact).toBe(true);
    expect(exactSource.matches[0]?.kind).toBe("exact_source");

    const exactHash = detectDuplicates(
      { contentHash: hash, name: candidate.name },
      [
        {
          id: "r2",
          name: "Other",
          sourceCanonicalUrl: null,
          importedContentHash: hash,
          ingredientNames: [],
        },
      ],
    );
    expect(exactHash.hasExact).toBe(true);
    expect(exactHash.matches[0]?.kind).toBe("exact_hash");

    const similar = detectDuplicates(
      {
        name: candidate.name,
        ingredients: candidate.ingredients,
      },
      [
        {
          id: "r3",
          name: candidate.name!,
          sourceCanonicalUrl: null,
          importedContentHash: null,
          ingredientNames: candidate.ingredients.map((i) => i.displayName),
        },
      ],
    );
    expect(similar.matches[0]?.kind).toBe("similar_content");
    expect(similar.matches[0]!.score).toBeGreaterThanOrEqual(0.72);
  });
});

describe("filterCopyrightFields", () => {
  it("keeps cooking fields and drops article/comment/review blobs", () => {
    const { filtered, droppedFields } = filterCopyrightFields({
      name: "Soup",
      recipeIngredient: ["1 cup broth"],
      recipeInstructions: ["Simmer."],
      articleBody: "Long copyrighted prose",
      comment: [{ text: "Yum" }],
      aggregateRating: { ratingValue: 5 },
      review: [{ reviewBody: "Great" }],
      publisher: { name: "Site" },
    });

    expect(filtered.name).toBe("Soup");
    expect(filtered.recipeIngredient).toEqual(["1 cup broth"]);
    expect(filtered.articleBody).toBeUndefined();
    expect(droppedFields).toEqual(
      expect.arrayContaining([
        "articleBody",
        "comment",
        "aggregateRating",
        "review",
        "publisher",
      ]),
    );
  });
});
