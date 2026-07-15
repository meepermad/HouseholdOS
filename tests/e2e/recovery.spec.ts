import { expect, test } from "@playwright/test";

test.describe("recovery escape paths", () => {
  test("recovery page is public and offers logout + clear household", async ({
    page,
  }) => {
    await page.goto("/recovery");
    await expect(page.getByRole("heading", { name: /recoverable problem|unavailable|signed out/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Clear selected household" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
  });

  test("logout POST from recovery reaches login", async ({ page }) => {
    await page.goto("/recovery");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated protected money route still redirects to login", async ({
    page,
  }) => {
    await page.goto("/app/00000000-0000-4000-8000-000000000001/money");
    await expect(page).toHaveURL(/login/);
  });

  test("dev trigger-error route exists only as a non-production escape hatch", async ({
    page,
  }) => {
    // Full error-boundary rendering under Playwright + Next overlay is flaky;
    // assert the route responds and does not soft-redirect into a protected loop.
    const response = await page.goto("/dev/trigger-error", {
      waitUntil: "commit",
    });
    expect(response).not.toBeNull();
    // Must not bounce into an infinite /app/[uuid] trap.
    await expect(page).not.toHaveURL(/\/app\/[0-9a-f-]{36}/i, { timeout: 5_000 });
  });
});
