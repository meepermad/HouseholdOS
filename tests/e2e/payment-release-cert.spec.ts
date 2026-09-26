import { expect, test, type Page } from "@playwright/test";
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

function appOrigin() {
  return (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100").replace(/\/$/, "");
}

function playwrightBrowsersInstalled(): boolean {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH
    ? process.env.PLAYWRIGHT_BROWSERS_PATH
    : path.join(os.homedir(), "AppData", "Local", "ms-playwright");
  if (!fs.existsSync(base)) return false;
  return fs.readdirSync(base).some((name) => name.startsWith("chromium"));
}

function watchHydration(page: Page) {
  const problems: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (
      /hydrat|did not match|Text content does not match|Rendered more hooks|Minified React error|nonce/i.test(
        text,
      )
    ) {
      problems.push(text.slice(0, 400));
    }
  });
  page.on("pageerror", (error) => {
    problems.push(error.message.slice(0, 400));
  });
  return problems;
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

async function loginForm(page: Page, email: string) {
  await page.goto("/login");
  await expect(page.getByTestId("login-form")).toBeVisible();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/app\/[0-9a-f-]{36}/, { timeout: 60_000 });
}

async function loginApi(page: Page, email: string) {
  const origin = appOrigin();
  const response = await page.request.post("/api/auth/sign-in", {
    form: { email, password, next: "/app" },
    headers: {
      origin,
      referer: `${origin}/login`,
      "sec-fetch-site": "same-origin",
    },
    maxRedirects: 0,
  });
  const location = response.headers().location ?? "";
  if (response.status() >= 400 || location.includes("error=")) {
    throw new Error(`sign-in failed ${response.status()}`);
  }
  const jar = await page.request.storageState();
  if (jar.cookies.length > 0) {
    await page.context().addCookies(jar.cookies);
  }
  await page.goto("/app");
  await page.waitForURL(/\/app\/[0-9a-f-]{36}/, { timeout: 60_000 });
}

async function confirmSharedExpense(
  client: Awaited<ReturnType<typeof authedClient>>["client"],
  args: {
    householdId: string;
    payerMembershipId: string;
    debtorMembershipId: string;
    merchant: string;
    declaredTotalCents: number;
    idempotencyKey: string;
  },
) {
  const { data: draft, error: draftError } = await client
    .from("expenses")
    .insert({
      household_id: args.householdId,
      created_by_membership_id: args.payerMembershipId,
      payer_membership_id: args.payerMembershipId,
      merchant: args.merchant,
      purchase_date: "2026-09-01",
      currency: "USD",
      declared_total_cents: args.declaredTotalCents,
      status: "draft",
    })
    .select("id")
    .single();
  if (draftError) throw draftError;
  const expenseId = draft.id;
  const { data: item, error: itemError } = await client
    .from("expense_items")
    .insert({
      expense_id: expenseId,
      household_id: args.householdId,
      description: args.merchant,
      total_cents: args.declaredTotalCents,
      allocation_mode: "equal_selected",
    })
    .select("id")
    .single();
  if (itemError) throw itemError;
  const { error: allocError } = await client.from("expense_item_allocations").insert([
    {
      item_id: item.id,
      expense_id: expenseId,
      household_id: args.householdId,
      membership_id: args.payerMembershipId,
      amount_cents: 0,
    },
    {
      item_id: item.id,
      expense_id: expenseId,
      household_id: args.householdId,
      membership_id: args.debtorMembershipId,
      amount_cents: 0,
    },
  ]);
  if (allocError) throw allocError;
  const calc = calculateExpense({
    payerMembershipId: args.payerMembershipId,
    eligibleMembershipIds: [args.payerMembershipId, args.debtorMembershipId],
    currency: "USD",
    householdCurrency: "USD",
    declaredTotalCents: args.declaredTotalCents,
    items: [
      {
        id: item.id,
        description: args.merchant,
        totalCents: args.declaredTotalCents,
        allocationMode: "equal_selected",
        participants: [
          { membershipId: args.payerMembershipId },
          { membershipId: args.debtorMembershipId },
        ],
      },
    ],
    adjustments: [],
  });
  if (!calc.ok) throw new Error("expense calculation failed");
  const debtorAmount =
    calc.obligations.find(
      (obligation) => obligation.debtorMembershipId === args.debtorMembershipId,
    )?.amountCents ?? 0;
  const snapshot = {
    calculated_subtotal_cents: calc.itemSubtotalCents,
    calculated_adjustments_cents: calc.adjustmentsNetCents,
    item_allocations: calc.lines.flatMap((line) =>
      line.sourceType === "item"
        ? line.allocations.map((allocation) => ({
            item_id: line.sourceId,
            membership_id: allocation.membershipId,
            amount_cents: allocation.amountCents,
          }))
        : [],
    ),
    adjustment_allocations: [],
    obligations: calc.obligations.map((obligation) => ({
      debtor_membership_id: obligation.debtorMembershipId,
      creditor_membership_id: obligation.creditorMembershipId,
      amount_cents: obligation.amountCents,
    })),
  } as unknown as Json;
  const confirmed = await client.rpc("confirm_expense", {
    p_expense_id: expenseId,
    p_idempotency_key: args.idempotencyKey,
    p_snapshot: snapshot,
  });
  if (confirmed.error) throw confirmed.error;
  const { data: obligations, error: oblError } = await client
    .from("reimbursement_obligations")
    .select("id, debtor_membership_id")
    .eq("expense_id", expenseId);
  if (oblError) throw oblError;
  const debtor = (obligations ?? []).find(
    (row) => row.debtor_membership_id === args.debtorMembershipId,
  );
  if (!debtor) throw new Error("debtor obligation missing");
  return { obligationId: debtor.id, expenseId, amountCents: debtorAmount };
}

test.describe.configure({ mode: "serial", timeout: 180_000 });

test.describe("payment release certification", () => {
  test.skip(!hasSupabase, "Requires Supabase env");
  test.skip(!playwrightBrowsersInstalled(), "Run `npx playwright install`");

  let admin: SupabaseClient<Database>;
  const createdUserIds: string[] = [];
  const runId = `relcert${Date.now().toString(36)}`;
  let emailA = "";
  let emailB = "";
  let householdNav = "";
  let householdOther = "";
  let householdIsolated = "";
  let householdPay = "";
  let householdMoney = "";
  let memAPay = "";
  let memBPay = "";
  let memAMoney = "";
  let memBMoney = "";
  let memBOther = "";
  const selected: Array<{ obligationId: string; merchant: string }> = [];
  let partial: { obligationId: string; expenseId: string; amountCents: number } = {
    obligationId: "",
    expenseId: "",
    amountCents: 0,
  };
  let duplicate: { obligationId: string; expenseId: string; amountCents: number } = {
    obligationId: "",
    expenseId: "",
    amountCents: 0,
  };
  let correction: { obligationId: string; expenseId: string; amountCents: number } = {
    obligationId: "",
    expenseId: "",
    amountCents: 0,
  };
  let matched: { obligationId: string; expenseId: string; amountCents: number } = {
    obligationId: "",
    expenseId: "",
    amountCents: 0,
  };
  let withReceipt: { obligationId: string; expenseId: string; amountCents: number } = {
    obligationId: "",
    expenseId: "",
    amountCents: 0,
  };
  let receiptId = "";
  let bare: { obligationId: string; expenseId: string; amountCents: number } = {
    obligationId: "",
    expenseId: "",
    amountCents: 0,
  };

  test.beforeAll(async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "Desktop Chrome");
    void browser;
    admin = createClient<Database>(url!, secretKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await admin.from("auth_registration_policy").upsert({
      id: 1,
      mode: "invite_only",
      allow_test_emails: true,
      test_email_domain: TEST_DOMAIN,
    });

    emailA = `rel-a-${runId}@${TEST_DOMAIN}`;
    emailB = `rel-b-${runId}@${TEST_DOMAIN}`;
    for (const email of [emailA, emailB]) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(created.error).toBeNull();
      createdUserIds.push(created.data.user!.id);
    }
    await admin.from("profiles").update({ display_name: "Rel Creditor" }).eq("id", createdUserIds[0]!);
    await admin.from("profiles").update({ display_name: "Rel Debtor" }).eq("id", createdUserIds[1]!);

    const a = await authedClient(emailA);
    const b = await authedClient(emailB);

    async function house(name: string, inviteB: boolean) {
      const created = await a.client.rpc("create_household", {
        p_name: name,
        p_acknowledge_reimbursement_policy: true,
      });
      if (created.error) throw created.error;
      const householdId = created.data as string;
      if (inviteB) {
        const token = generateInviteToken();
        const invite = await a.client.rpc("create_household_invitation", {
          p_household_id: householdId,
          p_email: emailB,
          p_token_hash: hashInviteToken(token),
          p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
          p_intended_roles: ["member"],
        });
        if (invite.error) throw invite.error;
        const accepted = await b.client.rpc("accept_household_invitation", {
          p_token_hash: hashInviteToken(token),
        });
        if (accepted.error) throw accepted.error;
      }
      return householdId;
    }

    householdNav = await house(`Rel Nav ${runId}`, true);
    householdOther = await house(`Rel Other ${runId}`, true);
    householdIsolated = await house(`Rel Isolated ${runId}`, false);
    householdPay = await house(`Rel Pay ${runId}`, true);
    householdMoney = await house(`Rel Money ${runId}`, true);

    const { data: aMemberships, error: aErr } = await a.client
      .from("household_memberships")
      .select("id, household_id, user_id");
    if (aErr) throw aErr;
    const { data: bMemberships, error: bErr } = await b.client
      .from("household_memberships")
      .select("id, household_id, user_id");
    if (bErr) throw bErr;
    const find = (
      rows: typeof aMemberships,
      householdId: string,
      userId: string,
    ) => rows!.find((row) => row.household_id === householdId && row.user_id === userId)!.id;
    memAPay = find(aMemberships, householdPay, a.userId);
    memBPay = find(bMemberships, householdPay, b.userId);
    memAMoney = find(aMemberships, householdMoney, a.userId);
    memBMoney = find(bMemberships, householdMoney, b.userId);
    memBOther = find(bMemberships, householdOther, b.userId);

    for (let index = 0; index < 10; index += 1) {
      const merchant = `Sel ${runId} ${index}`;
      const row = await confirmSharedExpense(a.client, {
        householdId: householdPay,
        payerMembershipId: memAPay,
        debtorMembershipId: memBPay,
        merchant,
        declaredTotalCents: 2000,
        idempotencyKey: `rel-sel-${runId}-${index}`,
      });
      selected.push({ obligationId: row.obligationId, merchant });
    }

    partial = await confirmSharedExpense(a.client, {
      householdId: householdMoney,
      payerMembershipId: memAMoney,
      debtorMembershipId: memBMoney,
      merchant: `Partial ${runId}`,
      declaredTotalCents: 2000,
      idempotencyKey: `rel-partial-${runId}`,
    });
    duplicate = await confirmSharedExpense(a.client, {
      householdId: householdMoney,
      payerMembershipId: memAMoney,
      debtorMembershipId: memBMoney,
      merchant: `Duplicate ${runId}`,
      declaredTotalCents: 1600,
      idempotencyKey: `rel-dup-${runId}`,
    });
    correction = await confirmSharedExpense(a.client, {
      householdId: householdMoney,
      payerMembershipId: memAMoney,
      debtorMembershipId: memBMoney,
      merchant: `Correction ${runId}`,
      declaredTotalCents: 2400,
      idempotencyKey: `rel-fix-${runId}`,
    });
    matched = await confirmSharedExpense(a.client, {
      householdId: householdMoney,
      payerMembershipId: memAMoney,
      debtorMembershipId: memBMoney,
      merchant: `Matched ${runId}`,
      declaredTotalCents: 1800,
      idempotencyKey: `rel-match-${runId}`,
    });
    withReceipt = await confirmSharedExpense(a.client, {
      householdId: householdMoney,
      payerMembershipId: memAMoney,
      debtorMembershipId: memBMoney,
      merchant: `Market ${runId}`,
      declaredTotalCents: 2200,
      idempotencyKey: `rel-rcpt-${runId}`,
    });
    bare = await confirmSharedExpense(a.client, {
      householdId: householdMoney,
      payerMembershipId: memAMoney,
      debtorMembershipId: memBMoney,
      merchant: `Bare ${runId}`,
      declaredTotalCents: 1400,
      idempotencyKey: `rel-bare-${runId}`,
    });

    const receipt = await admin
      .from("expense_receipts")
      .insert({
        household_id: householdMoney,
        uploaded_by_membership_id: memAMoney,
        payer_membership_id: memAMoney,
        storage_path: `test/${runId}/market.txt`,
        mime_type: "text/plain",
        file_name: "market.txt",
        size_bytes: 24,
        status: "confirmed",
        expense_id: withReceipt.expenseId,
        merchant_corrected: `Market ${runId}`,
        declared_total_cents: 2200,
        currency: "USD",
        intake_source: "upload",
      })
      .select("id")
      .single();
    if (receipt.error) throw receipt.error;
    receiptId = receipt.data.id;
    const line = await admin.from("expense_receipt_line_items").insert({
      receipt_id: receiptId,
      household_id: householdMoney,
      sort_index: 0,
      corrected_name: "Whole milk",
      quantity: 1,
      total_price_cents: 2200,
      classification: "shared_selected",
      review_status: "accepted",
    });
    if (line.error) throw line.error;
  });

  test.afterAll(async () => {
    if (admin) {
      await cleanupTestHouseholdsByRunId(admin, runId);
      await deleteTestAuthUsers(admin, createdUserIds);
    }
  });

  test("production navigation, themes, and a single settlement form", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "Desktop Chrome");
    const problems = watchHydration(page);
    const urls: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) urls.push(frame.url());
    });

    await page.goto("/app");
    await page.waitForURL(/\/login/, { timeout: 20_000 });
    await page.waitForTimeout(1_000);
    expect(page.url()).toContain("/login");
    const loginHops = urls.filter((item) => item.includes("/login") || item.includes("/app")).length;
    expect(loginHops).toBeLessThan(6);
    expect((await page.locator("body").innerText()).length).toBeGreaterThan(20);
    await expect(page.getByTestId("login-form")).toBeVisible();
    await expect(page.getByTestId("route-load-guard")).toHaveCount(0);

    await loginForm(page, emailB);
    await expect(page.getByTestId("home-action-center")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("household-shell")).toBeVisible();

    await page.goto("/app");
    await page.waitForURL(/\/app\/[0-9a-f-]{36}/, { timeout: 20_000 });
    await expect(page.getByTestId("home-action-center")).toBeVisible({ timeout: 20_000 });

    await page.goto(`/app/${householdNav}`);
    await expect(page.getByTestId("home-action-center")).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(page.getByTestId("home-action-center")).toBeVisible({ timeout: 20_000 });
    expect(page.url()).toContain(householdNav);

    await page.locator('[data-testid="user-menu-button"]:visible').click();
    const accountSheet = page.getByTestId("account-sheet");
    await accountSheet.getByText("Light", { exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await accountSheet.getByText("Dark", { exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("account-sheet")).toHaveCount(0);

    await page.goto(`/app/${householdNav}/money/balances`);
    await expect(page.getByRole("heading", { name: "Balances" }).first()).toBeVisible({
      timeout: 20_000,
    });
    await page.goBack();
    await expect(page.getByTestId("home-action-center")).toBeVisible({ timeout: 20_000 });
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`/app/${householdNav}/money/balances`));
    expect((await page.locator("body").innerText()).length).toBeGreaterThan(20);

    await page.goto(`/app/${householdNav}`);
    await page.locator('[data-testid="household-switcher-trigger"]:visible').click();
    await page.getByRole("button", { name: `Rel Other ${runId}` }).click();
    await page.waitForURL(new RegExp(`/app/${householdOther}(?:/|$)`), { timeout: 20_000 });
    await expect(page.getByTestId("home-action-center")).toBeVisible({ timeout: 20_000 });
    expect(await page.locator("body").innerText()).not.toContain(`Sel ${runId}`);

    await page.goto(
      `/app/${householdPay}/money/payments/new?direction=sent&counterparty=${memAPay}`,
    );
    await expect(page.getByTestId("household-shell")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("settle-up-form")).toHaveCount(1);
    await expect(page.getByTestId("settle-up-form")).toBeVisible();
    await expect(page.getByTestId("route-load-guard")).toHaveCount(0);

    await page.goto(`/app/${householdIsolated}`);
    await page.waitForTimeout(1_500);
    const denied = await page.locator("body").innerText();
    expect(denied).not.toContain(`Sel ${runId}`);
    if (page.url().includes(householdIsolated)) {
      expect(denied).toMatch(/do not have access|not found|could not|unavailable/i);
    }

    expect(problems).toEqual([]);
  });

  test("selection spans pages and settle entire covers more than eight expenses", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "Desktop Chrome");
    await loginApi(page, emailB);
    await page.goto(
      `/app/${householdPay}/money/payments/new?direction=sent&counterparty=${memAPay}`,
    );
    await expect(page.getByTestId("settle-up-form")).toHaveCount(1);
    const { data: balances } = await admin
      .from("obligation_balances_v")
      .select("official_outstanding_cents")
      .eq("household_id", householdPay);
    const ledgerCents = (balances ?? []).reduce(
      (sum, row) => sum + (row.official_outstanding_cents ?? 0),
      0,
    );
    const shown = await page.getByTestId("pair-balance").innerText();
    const match = shown.replace(/,/g, "").match(/\$(\d+)\.(\d{2})/);
    expect(match).not.toBeNull();
    expect(Number(match![1]) * 100 + Number(match![2])).toBe(ledgerCents);
    expect(ledgerCents).toBe(10_000);

    await page.getByTestId("choose-expenses").click();
    const firstBox = page.locator('[data-testid^="obligation-select-"]').first();
    const firstId = ((await firstBox.getAttribute("data-testid")) ?? "").replace(
      "obligation-select-",
      "",
    );
    await firstBox.check();
    await expect(page.getByTestId("selection-summary")).toHaveText("1 expense selected");
    await page.getByTestId(`expense-details-${firstId}`).click();
    await expect(page.getByTestId(`obligation-select-${firstId}`)).toBeChecked();
    await expect(page.getByTestId(`expense-detail-panel-${firstId}`)).toBeVisible();

    await page.getByTestId("select-all").click({ force: true });
    await expect(page.getByTestId("selection-summary")).toHaveText("8 expenses selected");
    await page.getByTestId("deselect-all").click({ force: true });
    await expect(page.getByTestId("selection-summary")).toHaveText("0 expenses selected");

    await page.getByTestId(`obligation-select-${firstId}`).check();
    await page.getByTestId("selection-page-next").click();
    await expect(page.getByText("Page 2 of 2")).toBeVisible();
    await page.locator('[data-testid^="obligation-select-"]').first().check();
    await expect(page.getByTestId("selection-summary")).toHaveText("2 expenses selected");
    await page.getByRole("button", { name: "Previous" }).click();
    await expect(page.getByTestId(`obligation-select-${firstId}`)).toBeChecked();

    await page.getByRole("button", { name: "Back" }).click();
    await page.getByTestId("settle-entire-balance").click();
    await expect(page.getByTestId("selection-summary")).toHaveText("10 expenses selected");
    await expect(page.getByTestId("selected-total")).toContainText("$100.00");
    const selectedRaw = await page.getByTestId("allocations-json").inputValue();
    const selectedIds = (JSON.parse(selectedRaw) as Array<{ obligationId: string }>)
      .map((row) => row.obligationId)
      .sort();
    expect(selectedIds).toEqual(selected.map((row) => row.obligationId).sort());

    await page.getByTestId("acknowledge-external").check();
    await page.getByTestId("submit-payment").click();
    await page.waitForURL(new RegExp(`/app/${householdPay}/money/payments/[0-9a-f-]{36}$`), {
      timeout: 30_000,
    });
    await expect(page.getByTestId("payment-narrative")).toContainText("reported sending");
    const paymentId = page.url().split("/").pop()!;

    const { data: allocations } = await admin
      .from("payment_allocations")
      .select("obligation_id, amount_cents")
      .eq("payment_id", paymentId);
    expect(allocations ?? []).toHaveLength(10);
    expect((allocations ?? []).reduce((sum, row) => sum + row.amount_cents, 0)).toBe(10_000);

    await page.goto(`/app/${householdPay}/money/balances`);
    await expect(page.getByText("Reported as sent").first()).toBeVisible({ timeout: 20_000 });

    await loginApi(page, emailA);
    await page.goto(`/app/${householdPay}/money/payments/${paymentId}`);
    await expect(page.getByText("Waiting for your acknowledgment").or(page.getByTestId("confirm-receipt"))).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId("confirm-receipt").click();
    await expect(page.getByTestId("payment-acknowledgment")).toContainText("acknowledged receiving", {
      timeout: 20_000,
    });
    await expect(page.getByTestId("payment-acknowledgment")).toContainText(
      "did not verify an outside account",
    );

    const { data: after } = await admin
      .from("obligation_balances_v")
      .select("official_outstanding_cents, pending_payment_cents")
      .eq("household_id", householdPay);
    expect((after ?? []).every((row) => row.official_outstanding_cents === 0)).toBe(true);
    expect((after ?? []).every((row) => row.pending_payment_cents === 0)).toBe(true);

    await page.goto(`/app/${householdPay}/money/balances#settled`);
    await expect(page.getByTestId("settled-history")).toContainText("Fully settled");
  });

  test("partial, remainder, duplicate, match, dispute, and reversal stay reconciled", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "Desktop Chrome");
    const a = await authedClient(emailA);

    await loginApi(page, emailA);
    await page.goto(
      `/app/${householdMoney}/money/payments/new?direction=received&counterparty=${memBMoney}`,
    );
    await page.getByTestId("choose-expenses").click();
    await page.getByTestId("expense-filter").fill(`Partial ${runId}`);
    await page.getByTestId(`obligation-select-${partial.obligationId}`).check();
    await expect(page.getByTestId("selection-summary")).toHaveText("1 expense selected");
    await page.getByTestId("payment-amount").fill("4.00");
    await page.getByTestId("acknowledge-external").check();
    await page.getByTestId("record-received").click();
    await page.waitForURL(new RegExp(`/app/${householdMoney}/money/payments/[0-9a-f-]{36}$`));
    await expect(page.getByTestId("payment-narrative")).toContainText("recorded receiving");
    const { data: partialBalance } = await admin
      .from("obligation_balances_v")
      .select("official_outstanding_cents")
      .eq("obligation_id", partial.obligationId)
      .single();
    expect(partialBalance?.official_outstanding_cents).toBe(partial.amountCents - 400);

    await page.goto(
      `/app/${householdMoney}/money/payments/new?direction=received&counterparty=${memBMoney}`,
    );
    await page.getByTestId("choose-expenses").click();
    await page.getByTestId("expense-filter").fill(`Partial ${runId}`);
    await page.getByTestId(`obligation-select-${partial.obligationId}`).check();
    await page.getByTestId("payment-amount").fill("6.00");
    await page.getByTestId("acknowledge-external").check();
    await page.getByTestId("record-received").click();
    await page.waitForURL(new RegExp(`/app/${householdMoney}/money/payments/[0-9a-f-]{36}$`));
    const { data: clearedPartial } = await admin
      .from("obligation_balances_v")
      .select("official_outstanding_cents")
      .eq("obligation_id", partial.obligationId)
      .single();
    expect(clearedPartial?.official_outstanding_cents).toBe(0);

    const { data: payerNotes } = await admin
      .from("user_notifications")
      .select("title, body")
      .eq("user_id", createdUserIds[1]!);
    expect(
      (payerNotes ?? []).some((row) => String(row.body).includes("recorded receiving")),
    ).toBe(true);

    await page.goto(
      `/app/${householdMoney}/money/payments/new?direction=received&counterparty=${memBMoney}`,
    );
    await page.getByTestId("choose-expenses").click();
    await page.getByTestId("expense-filter").fill(`Duplicate ${runId}`);
    await page.getByTestId(`obligation-select-${duplicate.obligationId}`).check();
    const idempotencyKey = await page.getByTestId("idempotency-key").inputValue();
    await page.getByTestId("acknowledge-external").check();
    await page.getByTestId("record-received").click();
    await page.waitForURL(new RegExp(`/app/${householdMoney}/money/payments/[0-9a-f-]{36}$`));
    const duplicatePaymentId = page.url().split("/").pop()!;
    const replay = await a.client.rpc("record_received_payment", {
      p_household_id: householdMoney,
      p_payer_membership_id: memBMoney,
      p_total_amount_cents: duplicate.amountCents,
      p_external_method: "cash",
      p_allocations: [
        { obligation_id: duplicate.obligationId, amount_cents: duplicate.amountCents },
      ] as unknown as Json,
      p_idempotency_key: idempotencyKey,
    });
    expect(replay.error).toBeNull();
    expect((replay.data as { id: string }).id).toBe(duplicatePaymentId);
    const { count: duplicateAllocations } = await admin
      .from("payment_allocations")
      .select("id", { count: "exact", head: true })
      .eq("obligation_id", duplicate.obligationId);
    expect(duplicateAllocations).toBe(1);

    await page.goto(
      `/app/${householdMoney}/money/payments/new?direction=received&counterparty=${memBMoney}`,
    );
    await page.getByTestId("choose-expenses").click();
    await page.getByTestId("expense-filter").fill(`Duplicate ${runId}`);
    await expect(page.getByText("No expenses match that filter.")).toBeVisible();
    await expect(page.getByTestId("selection-summary")).toHaveText("0 expenses selected");
    await expect(page.getByTestId("record-received")).toBeDisabled();

    await loginApi(page, emailB);
    await page.goto(
      `/app/${householdMoney}/money/payments/new?direction=sent&counterparty=${memAMoney}`,
    );
    await page.getByTestId("choose-expenses").click();
    await page.getByTestId("expense-filter").fill(`Matched ${runId}`);
    await page.getByTestId(`obligation-select-${matched.obligationId}`).check();
    await page.getByTestId("acknowledge-external").check();
    await page.getByTestId("submit-payment").click();
    await page.waitForURL(new RegExp(`/app/${householdMoney}/money/payments/[0-9a-f-]{36}$`));
    const matchedPaymentId = page.url().split("/").pop()!;
    await expect(page.getByTestId("payment-narrative")).toContainText("reported sending");
    const { data: pendingRow } = await admin
      .from("payments")
      .select("status")
      .eq("id", matchedPaymentId)
      .single();
    expect(pendingRow?.status).toBe("submitted");

    await loginApi(page, emailA);
    await page.goto(`/app/${householdMoney}/money/payments/${matchedPaymentId}`);
    await page.getByTestId("confirm-receipt").click();
    await expect(page.getByTestId("payment-acknowledgment")).toContainText("acknowledged receiving", {
      timeout: 20_000,
    });
    const { count: matchedPayments } = await admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("id", matchedPaymentId);
    expect(matchedPayments).toBe(1);
    const { data: recipientNotes } = await admin
      .from("user_notifications")
      .select("title, body")
      .eq("user_id", createdUserIds[0]!);
    expect(
      (recipientNotes ?? []).some((row) => String(row.title).includes("Payment reported as sent")),
    ).toBe(true);
    const { data: senderNotes } = await admin
      .from("user_notifications")
      .select("title, body")
      .eq("user_id", createdUserIds[1]!);
    expect(
      (senderNotes ?? []).some((row) => String(row.title).includes("Payment received")),
    ).toBe(true);

    await loginApi(page, emailB);
    await page.goto(`/app/${householdMoney}/money/payments/${matchedPaymentId}`);
    await page.locator("#payer-note").fill("Same transfer as the receipt.");
    await page.getByTestId("associate-payer-report").click();
    await expect
      .poll(async () => {
        const { count } = await admin
          .from("audit_events")
          .select("id", { count: "exact", head: true })
          .eq("entity_id", matchedPaymentId)
          .eq("event_type", "payment.payer_associated");
        return count ?? 0;
      })
      .toBe(1);
    expect(
      (
        await admin
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("id", matchedPaymentId)
      ).count,
    ).toBe(1);

    await loginApi(page, emailA);
    await page.goto(
      `/app/${householdMoney}/money/payments/new?direction=received&counterparty=${memBMoney}`,
    );
    await page.getByTestId("choose-expenses").click();
    await page.getByTestId("expense-filter").fill(`Correction ${runId}`);
    await page.getByTestId(`obligation-select-${correction.obligationId}`).check();
    await page.getByTestId("acknowledge-external").check();
    await page.getByTestId("record-received").click();
    await page.waitForURL(new RegExp(`/app/${householdMoney}/money/payments/[0-9a-f-]{36}$`));
    const correctionPaymentId = page.url().split("/").pop()!;
    const { data: beforeDispute } = await admin
      .from("obligation_balances_v")
      .select("official_outstanding_cents")
      .eq("obligation_id", correction.obligationId)
      .single();
    expect(beforeDispute?.official_outstanding_cents).toBe(0);

    await loginApi(page, emailB);
    await page.goto(`/app/${householdMoney}/money/payments/${correctionPaymentId}`);
    await page.locator("#dispute-reason").fill("Recorded against the wrong transfer.");
    await page.getByRole("button", { name: "Report a problem" }).click();
    await page.waitForURL(new RegExp(`/app/${householdMoney}/money/disputes/`), {
      timeout: 20_000,
    });
    const { data: duringDispute } = await admin
      .from("obligation_balances_v")
      .select("official_outstanding_cents")
      .eq("obligation_id", correction.obligationId)
      .single();
    expect(duringDispute?.official_outstanding_cents).toBe(0);
    const { data: disputes } = await admin
      .from("reimbursement_disputes")
      .select("id")
      .eq("payment_id", correctionPaymentId);
    expect(disputes ?? []).toHaveLength(1);

    await loginApi(page, emailA);
    await page.goto(`/app/${householdMoney}/money/payments/${correctionPaymentId}`);
    await page.getByTestId("reverse-reason").fill("Wrong transfer. Reversing and keeping the record.");
    await page.getByTestId("reverse-payment").click();
    await expect(page.getByTestId("payment-narrative")).toContainText("reversed", { timeout: 20_000 });
    const { data: reversed } = await admin
      .from("payments")
      .select("status")
      .eq("id", correctionPaymentId)
      .single();
    expect(reversed?.status).toBe("reversed");
    const { count: keptAllocations } = await admin
      .from("payment_allocations")
      .select("id", { count: "exact", head: true })
      .eq("payment_id", correctionPaymentId);
    expect(keptAllocations).toBe(1);
    const { data: restored } = await admin
      .from("obligation_balances_v")
      .select("official_outstanding_cents, pending_payment_cents")
      .eq("obligation_id", correction.obligationId)
      .single();
    expect(restored?.official_outstanding_cents).toBe(correction.amountCents);
    expect(restored?.pending_payment_cents).toBe(0);
  });

  test("receipt lineage reconciles and household switches drop stale data", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "Desktop Chrome");
    const a = await authedClient(emailA);
    await loginApi(page, emailA);
    await page.goto(
      `/app/${householdMoney}/money/payments/new?direction=received&counterparty=${memBMoney}`,
    );
    await page.getByTestId("choose-expenses").click();
    await page.getByTestId("expense-filter").fill(`Market ${runId}`);
    await page.getByTestId(`obligation-select-${withReceipt.obligationId}`).check();
    await page.getByTestId("acknowledge-external").check();
    await page.getByTestId("record-received").click();
    await page.waitForURL(new RegExp(`/app/${householdMoney}/money/payments/[0-9a-f-]{36}$`));
    const receiptPaymentId = page.url().split("/").pop()!;
    await expect(page.getByRole("link", { name: "Original expense" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Receipt and items" })).toBeVisible();
    const applied = await page.getByText("Applied to").locator("..").innerText();
    const appliedMatch = applied.replace(/,/g, "").match(/\$(\d+)\.(\d{2})/);
    expect(Number(appliedMatch![1]) * 100 + Number(appliedMatch![2])).toBe(withReceipt.amountCents);

    await page.getByRole("link", { name: "Original expense" }).click();
    await expect(page.getByText(`Market ${runId}`).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("link", { name: "View original receipt" }).click();
    await expect(page.getByText("Whole milk").first()).toBeVisible({ timeout: 20_000 });

    for (const [merchant, obligationId, expectsNoReceipt] of [
      [`Correction ${runId}`, correction.obligationId, false],
      [`Bare ${runId}`, bare.obligationId, true],
    ] as const) {
      await page.goto(
        `/app/${householdMoney}/money/payments/new?direction=received&counterparty=${memBMoney}`,
      );
      await page.getByTestId("choose-expenses").click();
      await page.getByTestId("expense-filter").fill(merchant);
      await page.getByTestId(`obligation-select-${obligationId}`).check();
      await page.getByTestId("acknowledge-external").check();
      await page.getByTestId("record-received").click();
      await page.waitForURL(new RegExp(`/app/${householdMoney}/money/payments/[0-9a-f-]{36}$`));
      if (expectsNoReceipt) {
        await expect(page.getByText("No receipt is attached.")).toBeVisible();
      }
    }

    await page.goto(`/app/${householdMoney}/money/balances#settled`);
    await expect(page.getByTestId("settled-history")).toContainText("Fully settled");
    await expect(page.getByTestId("settled-history")).toContainText(`Market ${runId}`);
    await expect(
      page.getByTestId("obligation-source").getByRole("link", { name: "Receipt" }).first(),
    ).toBeVisible();
    await page.getByRole("link", { name: "View settled balance" }).first().click();
    await expect(page.getByText("How was this calculated?").first()).toBeVisible({
      timeout: 20_000,
    });

    const { data: marketBalance } = await admin
      .from("obligation_balances_v")
      .select("official_outstanding_cents")
      .eq("obligation_id", withReceipt.obligationId)
      .single();
    expect(marketBalance?.official_outstanding_cents).toBe(0);
    const { data: payment } = await admin
      .from("payments")
      .select("total_amount_cents")
      .eq("id", receiptPaymentId)
      .single();
    expect(payment?.total_amount_cents).toBe(withReceipt.amountCents);

    await page.goto(
      `/app/${householdPay}/money/payments/new?direction=received&counterparty=${memBPay}`,
    );
    await expect(page.getByTestId("settle-up-form")).toBeVisible({ timeout: 20_000 });
    await page.locator("#household-switcher").selectOption({ label: `Rel Other ${runId}` });
    await page.waitForURL(new RegExp(`/app/${householdOther}(?:/|$)`), { timeout: 20_000 });
    await page.goto(
      `/app/${householdOther}/money/payments/new?direction=received&counterparty=${memBOther}`,
    );
    await expect(page.getByTestId("settle-up-form")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("does not currently owe")).toBeVisible();
    expect(await page.locator("body").innerText()).not.toContain(`Sel ${runId}`);
    expect(await page.locator("body").innerText()).not.toContain(`Market ${runId}`);

    const cross = await a.client.rpc("record_received_payment", {
      p_household_id: householdOther,
      p_payer_membership_id: memBOther,
      p_total_amount_cents: 100,
      p_external_method: "cash",
      p_allocations: [
        { obligation_id: withReceipt.obligationId, amount_cents: 100 },
      ] as unknown as Json,
      p_idempotency_key: `rel-cross-${runId}`,
    });
    expect(cross.error).not.toBeNull();
    const { count: otherPayments } = await admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdOther);
    expect(otherPayments).toBe(0);
  });
});
