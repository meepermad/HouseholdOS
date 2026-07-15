import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateInviteToken, hashInviteToken } from "../../src/lib/tokens";

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

test.describe("Phase 2.2 create and join household", () => {
  test.skip(!hasSupabase, "Requires Supabase env");
  test.skip(
    !playwrightBrowsersInstalled(),
    "Run `npx playwright install` (needs free disk space)",
  );

  test("zero-membership user can create a household and re-enter after refresh", async ({
    page,
  }) => {
    const runId = `${Date.now()}`;
    const email = `e2e-create-${runId}@${TEST_DOMAIN}`;
    const admin = createClient(url!, secretKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await admin.from("auth_registration_policy").upsert({
      id: 1,
      mode: "invite_only",
      allow_test_emails: true,
      test_email_domain: TEST_DOMAIN,
    });
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    expect(created.error).toBeNull();
    const userId = created.data.user!.id;

    try {
      await page.goto("/login");
      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/password/i).fill(password);
      await page.getByRole("button", { name: /sign in/i }).click();
      await page.waitForURL(/\/(app|onboarding)/);

      if (!page.url().includes("/onboarding")) {
        await page.goto("/onboarding");
      }

      await page.getByLabel(/household name/i).fill(`E2E House ${runId}`);
      await page.getByLabel(/purchase approval threshold/i).fill("50.00");
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: /create household/i }).click();

      await expect(page).toHaveURL(new RegExp(`/app/[0-9a-f-]{36}`), {
        timeout: 30_000,
      });
      await expect(
        page.getByRole("heading", { name: `E2E House ${runId}` }),
      ).toBeVisible();

      await page.reload();
      await expect(page).toHaveURL(new RegExp(`/app/[0-9a-f-]{36}`));
      await expect(
        page.getByRole("heading", { name: `E2E House ${runId}` }),
      ).toBeVisible();

      // Recovery path: clear selection cookie → selector → re-enter
      await page.request.post("/auth/clear-household", {
        form: { next: "/app" },
      });
      await page.goto("/app");
      await page.waitForURL(/\/onboarding/);
      await page.getByRole("button", { name: `E2E House ${runId}` }).click();
      await expect(page).toHaveURL(new RegExp(`/app/[0-9a-f-]{36}`));
      await expect(
        page.getByRole("heading", { name: `E2E House ${runId}` }),
      ).toBeVisible();
    } finally {
      const { data: mems } = await admin
        .from("household_memberships")
        .select("id, household_id")
        .eq("user_id", userId);
      for (const m of mems ?? []) {
        await admin
          .from("household_membership_roles")
          .delete()
          .eq("membership_id", m.id);
        await admin.from("household_memberships").delete().eq("id", m.id);
        await admin.from("household_settings").delete().eq("household_id", m.household_id);
        await admin.from("audit_events").delete().eq("household_id", m.household_id);
        await admin
          .from("user_preferences")
          .update({ current_household_id: null })
          .eq("current_household_id", m.household_id);
        await admin.from("households").delete().eq("id", m.household_id);
      }
      await admin.from("user_preferences").delete().eq("user_id", userId);
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  });

  test("invited user can accept and land in household", async ({ page, browser }) => {
    const runId = `${Date.now()}`;
    const creatorEmail = `e2e-creator-${runId}@${TEST_DOMAIN}`;
    const inviteeEmail = `e2e-invitee-${runId}@${TEST_DOMAIN}`;
    const admin = createClient(url!, secretKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await admin.from("auth_registration_policy").upsert({
      id: 1,
      mode: "invite_only",
      allow_test_emails: true,
      test_email_domain: TEST_DOMAIN,
    });

    const creator = await admin.auth.admin.createUser({
      email: creatorEmail,
      password,
      email_confirm: true,
    });
    const invitee = await admin.auth.admin.createUser({
      email: inviteeEmail,
      password,
      email_confirm: true,
    });
    expect(creator.error).toBeNull();
    expect(invitee.error).toBeNull();

    const pub = createClient(url!, publishableKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signed = await pub.auth.signInWithPassword({
      email: creatorEmail,
      password,
    });
    const creatorClient = createClient(url!, publishableKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${signed.data.session!.access_token}`,
        },
      },
    });
    const hh = await creatorClient.rpc("create_household", {
      p_name: `Invite Home ${runId}`,
      p_acknowledge_reimbursement_policy: true,
    });
    expect(hh.error).toBeNull();
    const token = generateInviteToken();
    const inv = await creatorClient.rpc("create_household_invitation", {
      p_household_id: hh.data,
      p_email: inviteeEmail,
      p_token_hash: hashInviteToken(token),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_intended_roles: ["member"],
    });
    expect(inv.error).toBeNull();

    try {
      await page.goto("/login");
      await page.getByLabel(/email/i).fill(inviteeEmail);
      await page.getByLabel(/password/i).fill(password);
      await page.getByRole("button", { name: /sign in/i }).click();
      await page.waitForURL(/\/(app|onboarding)/);

      await page.goto(`/join/${token}`);
      await page.getByRole("button", { name: /^accept$/i }).click();
      await expect(page).toHaveURL(new RegExp(`/app/${hh.data}`), {
        timeout: 30_000,
      });
      await expect(
        page.getByRole("heading", { name: `Invite Home ${runId}` }),
      ).toBeVisible();
      await page.reload();
      await expect(
        page.getByRole("heading", { name: `Invite Home ${runId}` }),
      ).toBeVisible();
    } finally {
      void browser;
      for (const userId of [creator.data.user!.id, invitee.data.user!.id]) {
        const { data: mems } = await admin
          .from("household_memberships")
          .select("id, household_id")
          .eq("user_id", userId);
        for (const m of mems ?? []) {
          await admin
            .from("household_membership_roles")
            .delete()
            .eq("membership_id", m.id);
          await admin.from("household_memberships").delete().eq("id", m.id);
        }
      }
      await admin.from("household_invitations").delete().eq("household_id", hh.data);
      await admin.from("household_settings").delete().eq("household_id", hh.data);
      await admin.from("audit_events").delete().eq("household_id", hh.data);
      await admin
        .from("user_preferences")
        .update({ current_household_id: null })
        .eq("current_household_id", hh.data);
      await admin.from("households").delete().eq("id", hh.data);
      for (const userId of [creator.data.user!.id, invitee.data.user!.id]) {
        await admin.from("user_preferences").delete().eq("user_id", userId);
        await admin.from("profiles").delete().eq("id", userId);
        await admin.auth.admin.deleteUser(userId);
      }
    }
  });
});
