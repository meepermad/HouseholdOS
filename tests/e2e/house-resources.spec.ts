import { expect, test } from "@playwright/test";

test.describe("house resources routes smoke", () => {
  test("unauthenticated house route redirects to login", async ({ page }) => {
    await page.goto("/app/00000000-0000-4000-8000-000000000001/house");
    await expect(page).toHaveURL(/login/);
  });

  test("authenticated member can open house hub and shopping", async ({
    page,
  }) => {
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
    await page.goto(`/app/${householdId}/house`);
    await expect(page.getByRole("heading", { name: "House" })).toBeVisible();
    await page.goto(`/app/${householdId}/house/inventory`);
    await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/app/${householdId}/house/shopping`);
    await expect(page.getByRole("heading").first()).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
