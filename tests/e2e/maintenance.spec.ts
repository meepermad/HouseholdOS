import { test, expect } from "@playwright/test";

test.describe("maintenance routes", () => {
  test("maintenance dashboard requires authentication", async ({ page }) => {
    await page.goto(
      "/app/00000000-0000-0000-0000-000000000001/maintenance",
    );
    await expect(page).toHaveURL(/login/);
  });
});
