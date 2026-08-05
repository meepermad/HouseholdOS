import { expect, test } from "@playwright/test";

/**
 * Coordinated usability smoke across Account / Financial / Notifications /
 * Navigation / Theme. Authenticated paths skip when E2E_* secrets are absent.
 */

const hasAuth =
  Boolean(process.env.E2E_EMAIL) &&
  Boolean(process.env.E2E_PASSWORD) &&
  Boolean(process.env.E2E_HOUSEHOLD_ID);

const householdId = process.env.E2E_HOUSEHOLD_ID ?? "";

test.describe("Usability consolidation suite", () => {
  test("account: forgot-password and login recovery CTAs", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: /forgot|reset/i })).toBeVisible();
    await page.goto("/login?error=session_expired");
    await expect(page.getByRole("link", { name: /forgot|reset password/i }).first()).toBeVisible();
  });

  test("theme: auth pages respect light and dark tokens", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => {
      localStorage.setItem("householdos-theme", "dark");
      document.documentElement.classList.add("dark");
    });
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.evaluate(() => {
      localStorage.setItem("householdos-theme", "light");
      document.documentElement.classList.remove("dark");
    });
    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("financial: money hub create entry exists when authenticated", async ({
    page,
  }) => {
    test.skip(!hasAuth, "Requires E2E_EMAIL, E2E_PASSWORD, E2E_HOUSEHOLD_ID");
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/(app|onboarding)/, { timeout: 30_000 });
    await page.goto(`/app/${householdId}/money`);
    await expect(
      page.getByRole("button", { name: /add to money|add expense|scan/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("navigation: primary is Home Money Calendar House", async ({ page }) => {
    test.skip(!hasAuth, "Requires E2E_EMAIL, E2E_PASSWORD, E2E_HOUSEHOLD_ID");
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/(app|onboarding)/, { timeout: 30_000 });
    await page.goto(`/app/${householdId}`);
    const nav = page.getByTestId("mobile-bottom-nav");
    await expect(nav.getByText("Home", { exact: true })).toBeVisible();
    await expect(nav.getByText("Money", { exact: true })).toBeVisible();
    await expect(nav.getByText("Calendar", { exact: true })).toBeVisible();
    await expect(nav.getByText("House", { exact: true })).toBeVisible();
    await expect(nav.getByText("Chores", { exact: true })).toHaveCount(0);
  });

  test("notifications: settings hide digest and email controls", async ({
    page,
  }) => {
    test.skip(!hasAuth, "Requires E2E_EMAIL, E2E_PASSWORD, E2E_HOUSEHOLD_ID");
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/(app|onboarding)/, { timeout: 30_000 });
    await page.goto(`/app/${householdId}/settings/notifications`);
    await expect(page.getByTestId("notification-settings-page")).toBeVisible();
    await expect(page.getByText(/Push timing \/ digest/i)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /^Email$/i })).toHaveCount(0);
    await expect(page.getByText(/Always on/i).first()).toBeVisible();
  });
});
