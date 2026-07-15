import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { calculateExpense } from "../../src/lib/expenses";
import { generateInviteToken, hashInviteToken } from "../../src/lib/tokens";
import type { Database, Json } from "../../src/types/database";
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

async function authedClient(email: string) {
  const res = await createClient<Database>(url!, publishableKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.signInWithPassword({ email, password });
  if (res.error) throw res.error;
  const client = createClient<Database>(url!, publishableKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${res.data.session!.access_token}` },
    },
  });
  return { client, userId: res.data.user!.id };
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(app|onboarding)/, { timeout: 30_000 });
}

/**
 * Browser settlement uses real dual sessions for confirm + balance UI.
 * Payment recording uses the authenticated RPC (same path as the settle-up
 * server action) so the suite stays Auth-rate-limit friendly while still
 * verifying multi-user official balance sync in the browser.
 */
async function submitPaymentAs(
  email: string,
  args: {
    householdId: string;
    recipientMembershipId: string;
    amountCents: number;
    obligationId: string;
    key: string;
    externalReference?: string;
    privateNote?: string;
  },
) {
  const session = await authedClient(email);
  const submitted = await session.client.rpc("submit_payment", {
    p_household_id: args.householdId,
    p_recipient_membership_id: args.recipientMembershipId,
    p_total_amount_cents: args.amountCents,
    p_external_method: "venmo",
    p_allocations: [
      { obligation_id: args.obligationId, amount_cents: args.amountCents },
    ] as unknown as Json,
    p_idempotency_key: args.key,
    p_external_reference: args.externalReference,
    p_private_note: args.privateNote,
  });
  expect(submitted.error).toBeNull();
  return (submitted.data as { id: string }).id;
}

test.describe.configure({ mode: "serial" });

test.describe("two-user settlement workflow", () => {
  test.skip(!hasSupabase, "Requires Supabase env");
  test.skip(
    !playwrightBrowsersInstalled(),
    "Run `npx playwright install` (needs free disk space)",
  );

  let admin: SupabaseClient<Database>;
  const createdUserIds: string[] = [];
  const runId = `e2e-set-${Date.now().toString(36)}`;
  let emailA = "";
  let emailB = "";
  let emailC = "";
  let householdId = "";
  let memA = "";
  let memB = "";
  let expenseId = "";
  let oblB = "";
  let contextA: Awaited<ReturnType<Browser["newContext"]>>;
  let contextB: Awaited<ReturnType<Browser["newContext"]>>;
  let pageA: Page;
  let pageB: Page;

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

    emailA = `e2e-sa-${runId}@${TEST_DOMAIN}`;
    emailB = `e2e-sb-${runId}@${TEST_DOMAIN}`;
    emailC = `e2e-sc-${runId}@${TEST_DOMAIN}`;
    for (const email of [emailA, emailB, emailC]) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(created.error).toBeNull();
      createdUserIds.push(created.data.user!.id);
    }

    const a = await authedClient(emailA);
    const hh = await a.client.rpc("create_household", {
      p_name: `E2E Settle ${runId}`,
      p_acknowledge_reimbursement_policy: true,
    });
    expect(hh.error).toBeNull();
    householdId = hh.data as string;
    const { data: mA } = await a.client
      .from("household_memberships")
      .select("id")
      .eq("household_id", householdId)
      .eq("user_id", a.userId)
      .single();
    memA = mA!.id;

    const tokenB = generateInviteToken();
    await a.client.rpc("create_household_invitation", {
      p_household_id: householdId,
      p_email: emailB,
      p_token_hash: hashInviteToken(tokenB),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_intended_roles: ["member"],
    });
    const b = await authedClient(emailB);
    await b.client.rpc("accept_household_invitation", {
      p_token_hash: hashInviteToken(tokenB),
    });
    const { data: mB } = await b.client
      .from("household_memberships")
      .select("id")
      .eq("household_id", householdId)
      .eq("user_id", b.userId)
      .single();
    memB = mB!.id;

    const tokenC = generateInviteToken();
    await a.client.rpc("create_household_invitation", {
      p_household_id: householdId,
      p_email: emailC,
      p_token_hash: hashInviteToken(tokenC),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_intended_roles: ["member"],
    });
    const c = await authedClient(emailC);
    await c.client.rpc("accept_household_invitation", {
      p_token_hash: hashInviteToken(tokenC),
    });

    const { data: draft } = await a.client
      .from("expenses")
      .insert({
        household_id: householdId,
        created_by_membership_id: memA,
        payer_membership_id: memA,
        merchant: "E2E Settle Mart",
        purchase_date: "2026-07-01",
        currency: "USD",
        declared_total_cents: 1000,
        status: "draft",
      })
      .select("*")
      .single();
    expenseId = draft!.id;
    const { data: item } = await a.client
      .from("expense_items")
      .insert({
        expense_id: expenseId,
        household_id: householdId,
        description: "Shared",
        total_cents: 1000,
        allocation_mode: "equal_selected",
      })
      .select("id")
      .single();
    await a.client.from("expense_item_allocations").insert([
      {
        item_id: item!.id,
        expense_id: expenseId,
        household_id: householdId,
        membership_id: memA,
        amount_cents: 0,
      },
      {
        item_id: item!.id,
        expense_id: expenseId,
        household_id: householdId,
        membership_id: memB,
        amount_cents: 0,
      },
    ]);
    const calc = calculateExpense({
      payerMembershipId: memA,
      eligibleMembershipIds: [memA, memB],
      currency: "USD",
      householdCurrency: "USD",
      declaredTotalCents: 1000,
      items: [
        {
          id: item!.id,
          description: "Shared",
          totalCents: 1000,
          allocationMode: "equal_selected",
          participants: [{ membershipId: memA }, { membershipId: memB }],
        },
      ],
      adjustments: [],
    });
    expect(calc.ok).toBe(true);
    if (!calc.ok) throw new Error("calc failed");
    const snapshot = {
      calculated_subtotal_cents: calc.itemSubtotalCents,
      calculated_adjustments_cents: calc.adjustmentsNetCents,
      item_allocations: calc.lines.flatMap((l) =>
        l.sourceType === "item"
          ? l.allocations.map((al) => ({
              item_id: l.sourceId,
              membership_id: al.membershipId,
              amount_cents: al.amountCents,
            }))
          : [],
      ),
      adjustment_allocations: [],
      obligations: calc.obligations.map((o) => ({
        debtor_membership_id: o.debtorMembershipId,
        creditor_membership_id: o.creditorMembershipId,
        amount_cents: o.amountCents,
      })),
    } as unknown as Json;
    expect(
      (
        await a.client.rpc("confirm_expense", {
          p_expense_id: expenseId,
          p_idempotency_key: `e2e-exp-${runId}`,
          p_snapshot: snapshot,
        })
      ).error,
    ).toBeNull();
    const { data: obls } = await a.client
      .from("reimbursement_obligations")
      .select("id, debtor_membership_id")
      .eq("expense_id", expenseId);
    oblB = (obls ?? []).find((o) => o.debtor_membership_id === memB)!.id;

    contextA = await browser.newContext();
    contextB = await browser.newContext();
    pageA = await contextA.newPage();
    pageB = await contextB.newPage();
    await login(pageA, emailA);
    await login(pageB, emailB);
  });

  test.afterAll(async () => {
    await contextA?.close();
    await contextB?.close();
    if (admin) {
      await cleanupTestHouseholdsByRunId(admin, runId);
      await deleteTestAuthUsers(admin, createdUserIds);
    }
  });

  test("partial then full settlement shows the same official balance for both users", async () => {
    // B can open settle-up for the household (UI surface), then records via RPC.
    await pageB.goto(`/app/${householdId}/money/payments/new`);
    await expect(pageB.getByTestId("settle-up-form")).toBeVisible({
      timeout: 15_000,
    });

    const paymentId = await submitPaymentAs(emailB, {
      householdId,
      recipientMembershipId: memA,
      amountCents: 300,
      obligationId: oblB,
      key: `e2e-p1-${runId}`,
    });

    await pageA.goto(`/app/${householdId}/money/payments/${paymentId}`);
    await pageA.getByTestId("confirm-receipt").click();
    await expect(pageA.getByText("Confirmed received").first()).toBeVisible({
      timeout: 20_000,
    });

    await pageA.goto(`/app/${householdId}/money/balances`);
    await pageB.goto(`/app/${householdId}/money/balances`);
    await expect(pageA.getByTestId("you-are-owed")).toContainText("2.00");
    await expect(pageB.getByTestId("you-owe")).toContainText("2.00");

    const remainderId = await submitPaymentAs(emailB, {
      householdId,
      recipientMembershipId: memA,
      amountCents: 200,
      obligationId: oblB,
      key: `e2e-p2-${runId}`,
    });
    await pageA.goto(`/app/${householdId}/money/payments/${remainderId}`);
    await pageA.getByTestId("confirm-receipt").click();
    await expect(pageA.getByText("Confirmed received").first()).toBeVisible({
      timeout: 20_000,
    });

    await pageA.goto(`/app/${householdId}/money/reimbursements/${oblB}`);
    await pageB.goto(`/app/${householdId}/money/reimbursements/${oblB}`);
    await expect(pageA.getByText("Settled").first()).toBeVisible();
    await expect(pageB.getByText("Settled").first()).toBeVisible();
  });

  test("private reference hidden from third member; cross-household URL denied", async () => {
    const a = await authedClient(emailA);
    const { data: confirmed } = await a.client
      .from("payments")
      .select("id")
      .eq("household_id", householdId)
      .eq("status", "confirmed")
      .order("confirmed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (confirmed) {
      expect(
        (
          await a.client.rpc("reverse_payment", {
            p_payment_id: confirmed.id,
            p_reason: "e2e privacy fixture",
          })
        ).error,
      ).toBeNull();
    }

    const secret = `E2E-PRIV-${runId}`;
    const paymentId = await submitPaymentAs(emailB, {
      householdId,
      recipientMembershipId: memA,
      amountCents: 50,
      obligationId: oblB,
      key: `e2e-priv-${runId}`,
      externalReference: secret,
      privateNote: "party only",
    });

    const browser = pageA.context().browser()!;
    const contextC = await browser.newContext();
    const pageC = await contextC.newPage();
    await login(pageC, emailC);
    await pageC.goto(`/app/${householdId}/money/payments/${paymentId}`);
    await expect(pageC.locator("body")).not.toContainText(secret);
    await expect(pageC.locator("body")).not.toContainText("party only");
    await contextC.close();

    const otherHouse = await (
      await authedClient(emailC)
    ).client.rpc("create_household", {
      p_name: `E2E Other ${runId}`,
      p_acknowledge_reimbursement_policy: true,
    });
    expect(otherHouse.error).toBeNull();
    await pageB.goto(`/app/${otherHouse.data}/money`);
    await expect(pageB.getByTestId("unauthorized-household")).toBeVisible({
      timeout: 15_000,
    });
  });
});
