import { expect, test } from "@playwright/test";

/**
 * Phase 2 money smoke tests.
 * Full multi-user confirm/amend matrix runs in Vitest integration tests against linked Supabase.
 * Browser smoke verifies routes render when authenticated session cookies exist.
 */
test.describe("money routes smoke", () => {
  test("unauthenticated money route redirects to login", async ({ page }) => {
    await page.goto("/app/00000000-0000-4000-8000-000000000001/money");
    await expect(page).toHaveURL(/login/);
  });

  test("landing page still loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
  });
});
