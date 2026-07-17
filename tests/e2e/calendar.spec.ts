import { expect, test, type Browser, type Page } from "@playwright/test";
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

async function pageWithStoredSession(
  browser: Browser,
  storageStatePath: string,
): Promise<Page> {
  const context = await browser.newContext({ storageState: storageStatePath });
  const page = await context.newPage();
  page.on("close", () => {
    void context.close();
  });
  return page;
}

test.describe("calendar routes smoke", () => {
  test("unauthenticated calendar route redirects to login", async ({ page }) => {
    await page.goto("/app/00000000-0000-4000-8000-000000000001/calendar");
    await expect(page).toHaveURL(/login/);
  });

  test("unauthenticated new-event route redirects to login", async ({ page }) => {
    await page.goto(
      "/app/00000000-0000-4000-8000-000000000001/calendar/new",
    );
    await expect(page).toHaveURL(/login/);
  });

  test("unauthenticated day view redirects to login", async ({ page }) => {
    await page.goto(
      "/app/00000000-0000-4000-8000-000000000001/calendar/day",
    );
    await expect(page).toHaveURL(/login/);
  });

  test("unauthenticated invitations route redirects to login", async ({
    page,
  }) => {
    await page.goto(
      "/app/00000000-0000-4000-8000-000000000001/calendar/invitations",
    );
    await expect(page).toHaveURL(/login/);
  });

  test("unauthenticated availability route redirects to login", async ({
    page,
  }) => {
    await page.goto(
      "/app/00000000-0000-4000-8000-000000000001/calendar/availability",
    );
    await expect(page).toHaveURL(/login/);
  });

  test("unauthenticated integrations settings redirects to login", async ({
    page,
  }) => {
    await page.goto(
      "/app/00000000-0000-4000-8000-000000000001/settings/integrations/calendar",
    );
    await expect(page).toHaveURL(/login/);
  });
});

test.describe.configure({ mode: "serial" });

test.describe("authenticated calendar smoke", () => {
  test.skip(!hasSupabase, "Requires Supabase env");
  test.skip(
    !playwrightBrowsersInstalled(),
    "Run `npx playwright install` (needs free disk space)",
  );

  let admin: SupabaseClient<Database>;
  const createdUserIds: string[] = [];
  const runId = `e2e-cal-${Date.now().toString(36)}`;
  let email = "";
  let householdId = "";
  let storageStatePath = "";

  test.beforeAll(async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "Desktop Chrome");

    admin = createClient<Database>(url!, secretKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await admin.from("auth_registration_policy").upsert({
      id: 1,
      mode: "invite_only",
      allow_test_emails: true,
      test_email_domain: TEST_DOMAIN,
    });

    email = `e2e-cal-${runId}@${TEST_DOMAIN}`;
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
      p_name: `E2E Calendar ${runId}`,
      p_acknowledge_reimbursement_policy: true,
    });
    expect(hh.error).toBeNull();
    householdId = hh.data as string;

    storageStatePath = path.join(
      os.tmpdir(),
      `householdos-calendar-e2e-${runId}.json`,
    );
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, email);
    await context.storageState({ path: storageStatePath });
    await context.close();
  });

  test.afterAll(async () => {
    if (storageStatePath && fs.existsSync(storageStatePath)) {
      fs.unlinkSync(storageStatePath);
    }
    if (!admin) return;
    if (householdId) {
      await cleanupTestHouseholdsByRunId(admin, runId);
    }
    await deleteTestAuthUsers(admin, createdUserIds);
  });

  test("calendar page shows agenda heading or empty state", async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "Desktop Chrome");
    const page = await pageWithStoredSession(browser, storageStatePath);
    await page.goto(`/app/${householdId}/calendar/agenda`);

    await expect(page.getByTestId("calendar-toolbar")).toBeVisible({
      timeout: 45_000,
    });
    await expect(
      page.getByRole("heading", { name: /Agenda|Month|Week|Day/i }),
    ).toBeVisible();
    await expect(
      page.getByTestId("calendar-overflow").or(
        page.getByRole("tablist", { name: "Calendar view" }),
      ),
    ).toBeVisible();
    await page.close();
  });

  test("day and invitations routes load", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "Desktop Chrome");
    const page = await pageWithStoredSession(browser, storageStatePath);
    await page.goto(`/app/${householdId}/calendar/day`);
    await expect(page.getByTestId("calendar-toolbar")).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByTestId("calendar-overflow").or(
        page.getByRole("tablist", { name: "Calendar view" }),
      ),
    ).toBeVisible();
    await page.goto(`/app/${householdId}/calendar/invitations`);
    await expect(
      page.getByRole("heading", { name: "Invitations" }),
    ).toBeVisible({ timeout: 20_000 });
    await page.goto(`/app/${householdId}/calendar/availability`);
    await expect(
      page.getByRole("heading", { name: "Find a time" }),
    ).toBeVisible({ timeout: 20_000 });
    await page.close();
  });

  test("new event page loads", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "Desktop Chrome");
    const page = await pageWithStoredSession(browser, storageStatePath);
    await page.goto(`/app/${householdId}/calendar/new`);
    await expect(
      page.getByRole("heading", { name: "New event" }),
    ).toBeVisible({ timeout: 20_000 });
    await page.close();
  });
});
