import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression: shopping recommendation gather must not N+1 meal ingredients.
 * Asserts the live generate path uses batched `.in("meal_plan_id", …)`.
 */
describe("shopping recommendation query shape", () => {
  it("batches meal_plan_ingredients by plan ids", () => {
    const src = readFileSync(
      join(
        process.cwd(),
        "src/lib/shopping/recommendations/generate.ts",
      ),
      "utf8",
    );
    expect(src).toMatch(/\.in\(\s*"meal_plan_id"/);
    expect(src).not.toMatch(
      /for \(const plan of plans\)[\s\S]*?\.from\(\s*"meal_plan_ingredients"/,
    );
  });

  it("batches rediscovery recipes and ingredients", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/shopping/rediscovery/generate.ts"),
      "utf8",
    );
    expect(src).toMatch(/\.in\(\s*"id",\s*candidateRecipeIds/);
    expect(src).toMatch(/\.in\(\s*"recipe_id",\s*candidateRecipeIds/);
  });

  it("does not import privileged supabase client in shopping intel libs", () => {
    const files = [
      "src/lib/shopping/recommendations/generate.ts",
      "src/lib/shopping/rediscovery/generate.ts",
      "src/lib/shopping/rediscovery/prepare-ingredients.ts",
      "src/app/actions/shopping-intel.ts",
    ];
    for (const file of files) {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      expect(src).not.toMatch(/privileged/i);
      expect(src).not.toMatch(/createServiceRoleClient|SUPABASE_SECRET_KEY/);
    }
  });
});
