/**
 * Receipt / setup / import / export e2e smoke.
 * Requires Supabase + Playwright browsers; skips otherwise.
 */
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

test.describe("Launch phase navigation and surfaces", () => {
  test.skip(!hasSupabase, "Requires Supabase env");
  test.skip(
    !playwrightBrowsersInstalled(),
    "Run `npx playwright install`",
  );

  let admin: SupabaseClient<Database>;
  const createdUserIds: string[] = [];
  const runId = `e2e-launch-${Date.now().toString(36)}`;
  let email = "";
  let householdId = "";

  test.beforeAll(async ({ browser }, testInfo) => {
    test.skip(
      testInfo.project.name !== "Desktop Chrome" &&
        testInfo.project.name !== "Mobile Chrome",
      "Launch suite on Chrome projects",
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
    email = `e2e-launch-${runId}@${TEST_DOMAIN}`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    expect(created.error).toBeNull();
    createdUserIds.push(created.data.user!.id);

    const signed = await createClient<Database>(url!, publishableKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await signed.auth.signInWithPassword({ email, password });
    const { data: hid, error } = await signed.rpc("create_household", {
      p_name: `Launch-${runId}`,
      p_acknowledge_reimbursement_policy: true,
    });
    expect(error).toBeNull();
    householdId = hid as string;
    void browser;
  });

  test.afterAll(async () => {
    if (admin) {
      await cleanupTestHouseholdsByRunId(admin, runId);
      await deleteTestAuthUsers(admin, createdUserIds);
    }
  });

  test("authenticated nav: money receipt surfaces + setup + import/export", async ({
    page,
  }) => {
    await login(page, email);
    await page.goto(`/app/${householdId}/money`);
    await expect(page.getByTestId("money-scan-receipt")).toBeVisible();
    await expect(page.getByTestId("money-receipt-drafts")).toBeVisible();

    await page.goto(`/app/${householdId}/money/receipts/new`);
    await expect(page.getByTestId("receipt-uploader")).toBeVisible();
    await expect(page.getByTestId("receipt-ocr-status")).toBeVisible();

    await page.goto(`/app/${householdId}/setup`);
    await expect(page.getByTestId("setup-wizard")).toBeVisible();

    await page.goto(`/app/${householdId}/settings`);
    await expect(page.getByTestId("settings-row-setup")).toBeVisible();
    await expect(page.getByTestId("settings-row-import")).toBeVisible();
    await expect(page.getByTestId("settings-row-export")).toBeVisible();

    await page.goto(`/app/${householdId}/settings/import`);
    await expect(page.getByTestId("import-csv-panel")).toBeVisible();
  });
});
