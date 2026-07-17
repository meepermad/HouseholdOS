import { test, expect } from "@playwright/test";

test.describe("governance routes", () => {
  test("governance dashboard requires authentication", async ({ page }) => {
    await page.goto(
      "/app/00000000-0000-0000-0000-000000000001/governance",
    );
    await expect(page).toHaveURL(/login/);
  });

  test("governance document deep link requires authentication", async ({
    page,
  }) => {
    await page.goto(
      "/app/00000000-0000-0000-0000-000000000001/governance/documents/00000000-0000-0000-0000-000000000002",
    );
    await expect(page).toHaveURL(/login/);
  });

  test("governance transition deep link requires authentication", async ({
    page,
  }) => {
    await page.goto(
      "/app/00000000-0000-0000-0000-000000000001/governance/transitions/00000000-0000-0000-0000-000000000003",
    );
    await expect(page).toHaveURL(/login/);
  });
});

const e2eEmail = process.env.E2E_EMAIL;
const e2ePassword = process.env.E2E_PASSWORD;
const e2eHouseholdId = process.env.E2E_HOUSEHOLD_ID;
const hasAuth = Boolean(e2eEmail && e2ePassword && e2eHouseholdId);

test.describe("governance authenticated smoke", () => {
  test.skip(!hasAuth, "Requires E2E_EMAIL, E2E_PASSWORD, E2E_HOUSEHOLD_ID");

  test("opens governance dashboard when signed in", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(e2eEmail!);
    await page.getByLabel(/password/i).fill(e2ePassword!);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.goto(`/app/${e2eHouseholdId}/governance`);
    await expect(page.getByRole("heading", { name: /governance/i })).toBeVisible();
  });
});
