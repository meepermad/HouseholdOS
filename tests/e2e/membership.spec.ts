import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const hasSupabase = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

function playwrightBrowsersInstalled(): boolean {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH
    ? process.env.PLAYWRIGHT_BROWSERS_PATH
    : path.join(os.homedir(), "AppData", "Local", "ms-playwright");
  if (!fs.existsSync(base)) return false;
  return fs.readdirSync(base).some((name) => name.startsWith("chromium"));
}

test.describe("membership critical path", () => {
  test.skip(!hasSupabase, "Requires Supabase env for end-to-end auth flows");
  test.skip(!playwrightBrowsersInstalled(), "Run `npx playwright install` (needs free disk space)");

  test("landing offers auth entry points", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("HouseholdOS")).toBeVisible();
    await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("signup page renders", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });
});
