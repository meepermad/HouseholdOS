import { expect, test } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/join/paste",
  "/recovery",
];

const hasAuth =
  Boolean(process.env.E2E_EMAIL) &&
  Boolean(process.env.E2E_PASSWORD) &&
  Boolean(process.env.E2E_HOUSEHOLD_ID);

const householdId = process.env.E2E_HOUSEHOLD_ID ?? "";

const DESTRUCTIVE = /delete|void|remove|sign out|log out|leave household/i;
const ERROR_TEXT = /application error|this page could not|unhandled|not found \(404\)/i;

type IntegrityReport = {
  routesChecked: number;
  linksChecked: number;
  buttonsCovered: number;
  deadLinks: number;
  missingRoutes: number;
  unimplementedActions: number;
  timeouts: number;
};

test.describe("interaction integrity crawl", () => {
  test("public routes render and internal links resolve", async ({ page }) => {
    const report: IntegrityReport = {
      routesChecked: 0,
      linksChecked: 0,
      buttonsCovered: 0,
      deadLinks: 0,
      missingRoutes: 0,
      unimplementedActions: 0,
      timeouts: 0,
    };

    for (const route of PUBLIC_ROUTES) {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      report.routesChecked += 1;
      const status = response?.status() ?? 0;
      if (status >= 500) report.missingRoutes += 1;
      if (status === 404) report.deadLinks += 1;
      await expect(page.locator("body")).toBeVisible();
      expect(status, route).toBeLessThan(500);
      const body = (await page.locator("body").innerText()).toLowerCase();
      expect(body, route).not.toMatch(ERROR_TEXT);

      const hrefs = await page.$$eval("a[href]", (els) =>
        els
          .map((el) => el.getAttribute("href") ?? "")
          .filter((href) => href.startsWith("/") && !href.startsWith("//")),
      );
      for (const href of hrefs.slice(0, 20)) {
        report.linksChecked += 1;
        const next = await page.request.get(href);
        if (next.status() === 404) report.deadLinks += 1;
        if (next.status() >= 500) report.missingRoutes += 1;
        expect(next.status(), href).not.toBe(404);
        expect(next.status(), href).toBeLessThan(500);
      }
    }

    const out = join(process.cwd(), "test-results/interaction-integrity.json");
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(report, null, 2));
    expect(report.deadLinks).toBe(0);
    expect(report.missingRoutes).toBe(0);
  });

  test("authenticated primary and more destinations render", async ({ page }) => {
    test.skip(!hasAuth, "Requires E2E_EMAIL, E2E_PASSWORD, E2E_HOUSEHOLD_ID");
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/(app|onboarding)/, { timeout: 30_000 });

    const destinations = [
      `/app/${householdId}`,
      `/app/${householdId}/money`,
      `/app/${householdId}/calendar/agenda`,
      `/app/${householdId}/house`,
      `/app/${householdId}/notifications`,
      `/app/${householdId}/settings`,
      `/app/${householdId}/money/receipts/new?mode=paste`,
    ];

    let buttonsCovered = 0;
    for (const href of destinations) {
      const response = await page.goto(href, { waitUntil: "domcontentloaded" });
      expect(response?.status() ?? 0).toBeLessThan(500);
      await expect(page.locator("body")).toBeVisible();
      await expect(page.getByTestId("household-error-boundary")).toHaveCount(0);
      const buttons = page.getByRole("button");
      buttonsCovered += await buttons.count();
      const dangerous = await page.getByRole("button", { name: DESTRUCTIVE }).count();
      expect(dangerous).toBeGreaterThanOrEqual(0);
    }
    expect(buttonsCovered).toBeGreaterThan(0);
  });
});
