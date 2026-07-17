import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Phase 6.6 recipe import smoke — fixture-driven, no live site fetches.
 */
test.describe("Phase 6.6 recipe import", () => {
  test("import fixtures exist for offline extraction smoke", () => {
    const root = process.cwd();
    const fixtures = [
      "tests/fixtures/recipes/json-ld-lemon-pasta.html",
      "tests/fixtures/recipes/json-ld-graph-multi.html",
      "tests/fixtures/recipes/html-fallback-chili.html",
      "src/lib/meals/import/pipeline.ts",
      "src/app/(protected)/app/[householdId]/recipes/import/page.tsx",
    ];
    for (const rel of fixtures) {
      expect(fs.existsSync(path.join(root, rel)), rel).toBe(true);
    }

    const lemon = fs.readFileSync(
      path.join(root, "tests/fixtures/recipes/json-ld-lemon-pasta.html"),
      "utf8",
    );
    expect(lemon).toContain("application/ld+json");
    expect(lemon).toContain("Fixture Lemon Pasta");
  });

  test("unauthenticated import route redirects to login", async ({ page }) => {
    await page.goto(
      "/app/00000000-0000-4000-8000-000000000001/recipes/import",
    );
    await expect(page).toHaveURL(/login/);
  });

  test("authenticated member can open import page", async ({ page }) => {
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    const householdId = process.env.E2E_HOUSEHOLD_ID;
    test.skip(
      !email || !password || !householdId,
      "Set E2E_EMAIL, E2E_PASSWORD, and E2E_HOUSEHOLD_ID for authenticated smoke",
    );

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/(app|onboarding)/);

    await page.goto(`/app/${householdId}/recipes/import`);
    await expect(
      page.getByRole("heading", { name: /Import from a public page/i }),
    ).toBeVisible();
    await expect(page.getByPlaceholder("https://example.com/recipe")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Import for review/i }),
    ).toBeVisible();
  });
});
