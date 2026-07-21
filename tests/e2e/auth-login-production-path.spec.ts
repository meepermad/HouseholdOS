import { expect, test } from "@playwright/test";

/**
 * Authenticated login → Home certification.
 * Requires E2E_EMAIL, E2E_PASSWORD, E2E_HOUSEHOLD_ID (never commit secrets).
 */
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const householdId = process.env.E2E_HOUSEHOLD_ID;
const hasAuth = Boolean(email && password && householdId);

test.describe("auth login production path", () => {
  test.skip(!hasAuth, "Set E2E_EMAIL, E2E_PASSWORD, and E2E_HOUSEHOLD_ID");

  test("sign-in reaches Home with visible action center", async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedChunks: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("response", (res) => {
      const url = res.url();
      if (
        res.status() >= 400 &&
        (url.includes("/_next/static/") || url.endsWith(".js"))
      ) {
        failedChunks.push(`${res.status()} ${url}`);
      }
    });

    await page.goto(`/login?next=/app/${householdId}`);
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);

    const submit = page.getByRole("button", { name: "Sign in" });
    await submit.click();

    await expect(
      page.getByText(/Signing in|Opening HouseholdOS/),
    ).toBeVisible({ timeout: 5000 });

    await expect(page).toHaveURL(new RegExp(`/app/${householdId}`), {
      timeout: 30000,
    });
    await expect(page.getByTestId("home-action-center")).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page.getByText("What needs attention in your household today."),
    ).toBeVisible();
    await expect(page.getByLabel("Loading household dashboard")).toHaveCount(0);
    await expect(page.getByTestId("protected-error-boundary")).toHaveCount(0);
    await expect(page.getByTestId("household-error-boundary")).toHaveCount(0);

    const bottomNav = page.locator("[data-testid='bottom-nav'], nav").first();
    await expect(bottomNav).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("home-action-center")).toBeVisible();

    await page.getByRole("link", { name: /Calendar/i }).first().click();
    await expect(page).toHaveURL(/calendar/);

    await page.goto(`/app/${householdId}`);
    await expect(page.getByTestId("home-action-center")).toBeVisible();

    expect(failedChunks, failedChunks.join("\n")).toEqual([]);
    const actionable = consoleErrors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("Download the React DevTools"),
    );
    expect(actionable, actionable.join("\n")).toEqual([]);
  });

  test("stale household deep link still authenticates", async ({ page }) => {
    const stale = "00000000-0000-4000-8000-000000000000";
    await page.goto(`/login?next=/app/${stale}`);
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).not.toHaveURL(/\/login/, { timeout: 30000 });
    await expect(page).not.toHaveURL(new RegExp(stale));
    // Preferred household, onboarding, or /app — never credential failure loop.
    await expect(page.locator("body")).not.toContainText(
      "Invalid login credentials",
    );
  });
});
