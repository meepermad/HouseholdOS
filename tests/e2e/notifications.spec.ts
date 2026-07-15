import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Database } from "../../src/types/database";
import {
  cleanupTestHouseholdsByRunId,
  deleteTestAuthUsers,
} from "../helpers/cleanup-test-households";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const hasSupabase = Boolean(url && secretKey && publishableKey);
const TEST_DOMAIN = "hos-itest.local";
const password = "Test-Password-123!";

function playwrightBrowsersInstalled(): boolean {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH
    ? process.env.PLAYWRIGHT_BROWSERS_PATH
    : path.join(os.homedir(), "AppData", "Local", "ms-playwright");
  if (!fs.existsSync(base)) return false;
  return fs.readdirSync(base).some((name) => name.startsWith("chromium"));
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(app|onboarding)/, { timeout: 30_000 });
}

test.describe.configure({ mode: "serial" });

test.describe("Phase 3.1 notification UI", () => {
  test.skip(!hasSupabase, "Requires Supabase env");
  test.skip(
    !playwrightBrowsersInstalled(),
    "Run `npx playwright install` (needs free disk space)",
  );

  let admin: SupabaseClient<Database>;
  const createdUserIds: string[] = [];
  const runId = `e2e-notif-${Date.now().toString(36)}`;
  let email = "";
  let householdId = "";

  test.beforeAll(async ({ browser }, testInfo) => {
    test.skip(
      testInfo.project.name !== "Desktop Chrome" &&
        testInfo.project.name !== "Mobile Chrome",
      "Notification UI suite runs on Desktop Chrome + Mobile Chrome",
    );

    admin = createClient<Database>(url!, secretKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await admin.from("auth_registration_policy").upsert({
      id: 1,
      mode: "invite_only",
      allow_test_emails: true,
      test_email_domain: TEST_DOMAIN,
    });

    email = `e2e-notif-${runId}@${TEST_DOMAIN}`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    expect(created.error).toBeNull();
    createdUserIds.push(created.data.user!.id);

    const signed = await createClient<Database>(url!, publishableKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    }).auth.signInWithPassword({ email, password });
    expect(signed.error).toBeNull();
    const client = createClient<Database>(url!, publishableKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${signed.data.session!.access_token}`,
        },
      },
    });
    const hh = await client.rpc("create_household", {
      p_name: `E2E Notif ${runId}`,
      p_acknowledge_reimbursement_policy: true,
    });
    expect(hh.error).toBeNull();
    householdId = hh.data as string;

    // Warm browser so beforeAll skip logic binds once; suite uses fresh pages per test.
    const ctx = await browser.newContext();
    await ctx.close();
  });

  test.afterAll(async () => {
    if (!admin) return;
    if (householdId) {
      await cleanupTestHouseholdsByRunId(admin, runId);
    }
    await deleteTestAuthUsers(admin, createdUserIds);
  });

  test("settings page shows push guidance without requiring permission", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "Desktop Chrome");
    await login(page, email);
    await page.goto(`/app/${householdId}/settings/notifications`);
    await expect(page.getByTestId("notification-settings-page")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("push-permission-card")).toBeVisible();
    // Unsupported or not-configured guidance — never require enabling push in CI.
    await expect(
      page.getByTestId("push-permission-card").getByRole("heading"),
    ).toBeVisible();
  });

  test("opens notification inbox", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "Desktop Chrome");
    await login(page, email);
    await page.goto(`/app/${householdId}/notifications`);
    await expect(page.getByTestId("notifications-inbox-page")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("notification-inbox")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Inbox" }),
    ).toBeVisible();
  });

  test("mobile bottom nav exposes inbox with safe-area padding", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "Mobile Chrome");
    await login(page, email);
    await page.goto(`/app/${householdId}`);
    const bottomNav = page.getByTestId("mobile-bottom-nav");
    await expect(bottomNav).toBeVisible({ timeout: 20_000 });
    await expect(bottomNav.getByRole("link", { name: /inbox/i })).toBeVisible();

    const className = await bottomNav.getAttribute("class");
    expect(className ?? "").toMatch(/safe-pb|safe-area/);

    await bottomNav.getByRole("link", { name: /inbox/i }).click();
    await expect(page).toHaveURL(
      new RegExp(`/app/${householdId}/notifications`),
    );
    await expect(page.getByTestId("notification-inbox")).toBeVisible();
  });

  test("dark mode notification settings remain readable", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "Desktop Chrome");
    await login(page, email);
    await page.goto(`/app/${householdId}/settings/profile`);
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible({
      timeout: 20_000,
    });

    // Prefer storage + reload (same path as theme-responsive e2e) so the class
    // is applied before hydration races with controlled radios.
    await page.evaluate(() => {
      localStorage.setItem("householdos-theme", "dark");
    });
    await page.reload();
    await expect
      .poll(async () =>
        page.evaluate(() =>
          document.documentElement.classList.contains("dark"),
        ),
      )
      .toBe(true);

    await page.goto(`/app/${householdId}/settings/notifications`);
    await expect(page.getByTestId("notification-settings-page")).toBeVisible();
    await expect(page.getByTestId("push-permission-card")).toBeVisible();

    const contrast = await page.evaluate(() => {
      const main = document.querySelector(
        '[data-testid="notification-settings-page"]',
      );
      if (!main) return null;
      const heading = main.querySelector("h1");
      const headingColor = heading
        ? getComputedStyle(heading).color
        : getComputedStyle(main).color;
      return {
        dark: document.documentElement.classList.contains("dark"),
        headingColor,
        visible:
          heading instanceof HTMLElement && heading.offsetParent !== null,
      };
    });
    expect(contrast?.dark).toBe(true);
    expect(contrast?.visible).toBe(true);
    expect(contrast?.headingColor).toBeTruthy();
  });

  test("profile links to notification settings", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "Desktop Chrome");
    await login(page, email);
    await page.goto(`/app/${householdId}/settings/profile`);
    const link = page.getByTestId("profile-notification-settings-link");
    await expect(link).toBeVisible({ timeout: 20_000 });
    await link.click();
    await expect(page).toHaveURL(
      new RegExp(`/app/${householdId}/settings/notifications`),
    );
    await expect(page.getByTestId("notification-settings-page")).toBeVisible();
  });
});
