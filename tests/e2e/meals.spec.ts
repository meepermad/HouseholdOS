import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test.describe("Phase 6.5 meals modules", () => {
  test("clean tracked-tree meal modules are present in workspace source", () => {
    const root = process.cwd();
    const required = [
      "src/lib/meals/index.ts",
      "src/lib/meals/normalize.ts",
      "src/lib/meals/match.ts",
      "src/lib/meals/scale.ts",
      "src/lib/meals/shopping-prep.ts",
      "src/lib/meals/import/pipeline.ts",
      "src/lib/meals/import/url-security.ts",
      "src/lib/meals/import/fetch-page.ts",
      "src/lib/meals/import/robots.ts",
      "src/app/(protected)/app/[householdId]/meals/page.tsx",
      "src/app/(protected)/app/[householdId]/recipes/page.tsx",
      "src/app/(protected)/app/[householdId]/recipes/import/page.tsx",
      "src/app/(protected)/app/[householdId]/recipes/request/page.tsx",
      "src/app/(protected)/app/[householdId]/meal-prep/page.tsx",
      "src/app/(protected)/app/[householdId]/settings/meals/page.tsx",
      "supabase/migrations/20260721010000_meals_schema.sql",
      "supabase/migrations/20260721010400_meals_lifecycle_rpcs.sql",
      "supabase/migrations/20260722010000_recipe_import.sql",
    ];
    for (const rel of required) {
      expect(fs.existsSync(path.join(root, rel)), rel).toBe(true);
    }
  });
});
