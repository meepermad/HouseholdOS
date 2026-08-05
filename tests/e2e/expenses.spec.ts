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

/**
 * Phase 2 money smoke tests.
 * Full multi-user confirm/amend matrix runs in Vitest integration tests against linked Supabase.
 * Browser smoke verifies routes render when authenticated session cookies exist.
 */
test.describe("money routes smoke", () => {
  test("unauthenticated money route redirects to login", async ({ page }) => {
    await page.goto("/app/00000000-0000-4000-8000-000000000001/money");
    await expect(page).toHaveURL(/login/);
  });

  test("landing page still loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
  });
});

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

test.describe("money create sheet", () => {
  test.skip(!hasSupabase, "Requires Supabase env");
  test.skip(
    !playwrightBrowsersInstalled(),
    "Run `npx playwright install` (needs free disk space)",
  );

  let admin: SupabaseClient<Database>;
  const createdUserIds: string[] = [];
  const runId = `e2e-create-${Date.now().toString(36)}`;
  let email = "";
  let householdId = "";

  test.beforeAll(async ({}, testInfo) => {
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

    email = `e2e-mc-${runId}@${TEST_DOMAIN}`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    expect(created.error).toBeNull();
    createdUserIds.push(created.data.user!.id);

    const signIn = await createClient<Database>(url!, publishableKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    }).auth.signInWithPassword({ email, password });
    expect(signIn.error).toBeNull();
    const member = createClient<Database>(url!, publishableKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${signIn.data.session!.access_token}`,
        },
      },
    });
    const hh = await member.rpc("create_household", {
      p_name: `E2E Create ${runId}`,
      p_acknowledge_reimbursement_policy: true,
    });
    expect(hh.error).toBeNull();
    householdId = hh.data as string;
  });

  test.afterAll(async () => {
    if (admin) {
      await cleanupTestHouseholdsByRunId(admin, runId);
      await deleteTestAuthUsers(admin, createdUserIds);
    }
  });

  test("Add opens the create sheet with expense entry", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "Desktop Chrome");

    await login(page, email);
    await page.goto(`/app/${householdId}/money`);

    await page.getByTestId("money-create-open").click();
    await expect(page.getByTestId("money-create-sheet")).toBeVisible();
    await expect(page.getByTestId("money-create-add-expense")).toBeVisible();

    await page.getByTestId("money-create-add-expense").click();
    await expect(page).toHaveURL(new RegExp(`/money/expenses/new$`));
  });
});
