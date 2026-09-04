import { expect, test } from "@playwright/test";

test.describe("receipt routes", () => {
  test("unauthenticated receipt capture redirects to login", async ({ page }) => {
    await page.goto(
      "/app/00000000-0000-4000-8000-000000000001/money/receipts/new",
    );
    await expect(page).toHaveURL(/login/);
  });

  test("unauthenticated receipt draft inbox redirects to login", async ({
    page,
  }) => {
    await page.goto("/app/00000000-0000-4000-8000-000000000001/money/receipts");
    await expect(page).toHaveURL(/login/);
  });
});
