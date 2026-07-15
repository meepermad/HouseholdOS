import { expect, test } from "@playwright/test";

/**
 * Smoke coverage for payment routes. Auth-heavy settlement flows are covered by
 * serial Vitest integration tests to reduce Supabase Auth rate-limit pressure.
 */
test.describe("payments routes smoke", () => {
  test("unauthenticated settle-up redirects to login", async ({ page }) => {
    await page.goto(
      "/app/00000000-0000-4000-8000-000000000001/money/payments/new",
    );
    await expect(page).toHaveURL(/login/);
  });

  test("unauthenticated payments list redirects to login", async ({ page }) => {
    await page.goto("/app/00000000-0000-4000-8000-000000000001/money/payments");
    await expect(page).toHaveURL(/login/);
  });

  test("unauthenticated ledger redirects to login", async ({ page }) => {
    await page.goto("/app/00000000-0000-4000-8000-000000000001/money/ledger");
    await expect(page).toHaveURL(/login/);
  });
});
