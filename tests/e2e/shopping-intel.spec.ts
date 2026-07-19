import { expect, test } from "@playwright/test";

/**
 * Shopping Intelligence authenticated smoke (skips without E2E credentials).
 */
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const householdId = process.env.E2E_HOUSEHOLD_ID;
const hasAuth = Boolean(email && password && householdId);

test.describe("Shopping Intelligence e2e", () => {
  test.skip(!hasAuth, "Requires E2E_EMAIL, E2E_PASSWORD, E2E_HOUSEHOLD_ID");

  test("recommendations, trip, and rediscovery routes load without GPS", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/app/);

    const permissions: string[] = [];
    page.on("dialog", async (d) => d.dismiss());
    await page.addInitScript(() => {
      const original = navigator.permissions?.query?.bind(navigator.permissions);
      if (original) {
        navigator.permissions.query = (desc: PermissionDescriptor) => {
          (window as unknown as { __permLog: string[] }).__permLog ??= [];
          (window as unknown as { __permLog: string[] }).__permLog.push(
            String(desc.name),
          );
          return original(desc);
        };
      }
      Object.defineProperty(navigator, "geolocation", {
        value: {
          getCurrentPosition: () => {
            throw new Error("GPS must not be requested");
          },
          watchPosition: () => 0,
          clearWatch: () => undefined,
        },
      });
    });

    await page.goto(`/app/${householdId}/house/shopping/recommendations`);
    await expect(page.getByTestId("shopping-recommendations")).toBeVisible();
    await expect(page.getByTestId("household-context-label")).toBeVisible();

    const generate = page.getByTestId("generate-shopping-recommendations");
    if (await generate.isVisible()) {
      await generate.click();
      await page.waitForTimeout(1500);
    }

    await page.goto(`/app/${householdId}/house/shopping`);
    const start = page.getByTestId("start-shopping-trip");
    if (await start.isVisible()) {
      await start.click();
      await page.waitForURL(/\/trip/);
      await expect(page.getByTestId("complete-shopping-trip").or(page.getByText(/Still needed|Shopping/i))).toBeVisible();
    }

    await page.goto(`/app/${householdId}/house/recipes/rediscover`);
    await expect(page.getByTestId("forgotten-favorites")).toBeVisible();
    await expect(page.getByTestId("household-context-label")).toBeVisible();

    await page.goto(`/app/${householdId}/settings/shopping`);
    await expect(page.getByText(/Shopping|rediscovery|Forgotten/i).first()).toBeVisible();

    const permLog = await page.evaluate(
      () => (window as unknown as { __permLog?: string[] }).__permLog ?? [],
    );
    expect(permLog).not.toContain("geolocation");
    void permissions;
  });
});
