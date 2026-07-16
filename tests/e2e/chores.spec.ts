import { expect, test } from "@playwright/test";

test.describe("chores routes smoke", () => {
  test("unauthenticated chores route redirects to login", async ({ page }) => {
    await page.goto("/app/00000000-0000-4000-8000-000000000001/chores");
    await expect(page).toHaveURL(/login/);
  });

  test("authenticated member can navigate to the chore board", async ({ page }) => {
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    const householdId = process.env.E2E_HOUSEHOLD_ID;
    test.skip(!email || !password || !householdId, "Set E2E_EMAIL, E2E_PASSWORD, and E2E_HOUSEHOLD_ID for authenticated smoke");

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/(app|onboarding)/);
    await page.goto(`/app/${householdId}/chores`);
    await expect(page.getByRole("heading", { name: "Chores" })).toBeVisible();
  });

  // Multi-user reassignment and verification are covered at the RPC boundary;
  // this remains a route-level smoke until shared multi-user fixtures land.
});
