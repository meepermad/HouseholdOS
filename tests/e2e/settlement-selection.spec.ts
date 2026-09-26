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
  // The dev server aborts the browser's native login POST (ERR_ABORTED against
  // a competing /login request). The Route Handler is the same one the form
  // posts to; its Set-Cookie lands in this browser context.
  const response = await page.request.post("/api/auth/sign-in", {
    form: { email, password, next: "/app" },
    headers: {
      origin: "http://localhost:3000",
      referer: "http://localhost:3000/login",
      "sec-fetch-site": "same-origin",
    },
    maxRedirects: 0,
  });
  const location = response.headers().location ?? "";
  if (response.status() >= 400 || location.includes("error=")) {
    throw new Error(
      `sign-in failed ${response.status()} location=${location} body=${(await response.text()).slice(0, 300)}`,
    );
  }
  const jar = await page.request.storageState();
  if (jar.cookies.length > 0) {
    await page.context().addCookies(jar.cookies);
  }
  await page.goto("/app");
  await page.waitForURL(/\/(app|onboarding)/, { timeout: 60_000 });
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
  return debtor.id;
}

test.describe.configure({ mode: "serial", timeout: 120_000 });

test.describe("settlement selection and recipient receipt", () => {
  test.skip(!hasSupabase, "Requires Supabase env");
  test.skip(!playwrightBrowsersInstalled(), "Run `npx playwright install`");

  let admin: SupabaseClient<Database>;
  const createdUserIds: string[] = [];
  const runId = `e2e-sel-${Date.now().toString(36)}`;
  let emailA = "";
  let emailB = "";
  let householdSelect = "";
  let householdReceipt = "";
  let memA = "";
  let memB = "";
  let memAReceipt = "";
  let memBReceipt = "";
  const selectedObligationIds: string[] = [];

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

    emailA = `e2e-sel-a-${runId}@${TEST_DOMAIN}`;
    emailB = `e2e-sel-b-${runId}@${TEST_DOMAIN}`;
    for (const email of [emailA, emailB]) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(created.error).toBeNull();
      createdUserIds.push(created.data.user!.id);
    }
    await admin
      .from("profiles")
      .update({ display_name: "Atem" })
      .eq("id", createdUserIds[0]!);
    await admin
      .from("profiles")
      .update({ display_name: "Andrew" })
      .eq("id", createdUserIds[1]!);

    const a = await authedClient(emailA);
    const selectHouse = await a.client.rpc("create_household", {
      p_name: `E2E Select ${runId}`,
      p_acknowledge_reimbursement_policy: true,
    });
    expect(selectHouse.error).toBeNull();
    householdSelect = selectHouse.data as string;
    const receiptHouse = await a.client.rpc("create_household", {
      p_name: `E2E Receipt ${runId}`,
      p_acknowledge_reimbursement_policy: true,
    });
    expect(receiptHouse.error).toBeNull();
    householdReceipt = receiptHouse.data as string;

    const token = generateInviteToken();
    await a.client.rpc("create_household_invitation", {
      p_household_id: householdSelect,
      p_email: emailB,
      p_token_hash: hashInviteToken(token),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_intended_roles: ["member"],
    });
    const b = await authedClient(emailB);
    expect(
      (
        await b.client.rpc("accept_household_invitation", {
          p_token_hash: hashInviteToken(token),
        })
      ).error,
    ).toBeNull();

    const token2 = generateInviteToken();
    await a.client.rpc("create_household_invitation", {
      p_household_id: householdReceipt,
      p_email: emailB,
      p_token_hash: hashInviteToken(token2),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_intended_roles: ["member"],
    });
    expect(
      (
        await b.client.rpc("accept_household_invitation", {
          p_token_hash: hashInviteToken(token2),
        })
      ).error,
    ).toBeNull();

    const { data: memberships } = await a.client
      .from("household_memberships")
      .select("id, household_id, user_id");
    memA = memberships!.find(
      (row) => row.household_id === householdSelect && row.user_id === a.userId,
    )!.id;
    memAReceipt = memberships!.find(
      (row) => row.household_id === householdReceipt && row.user_id === a.userId,
    )!.id;
    const { data: bMemberships } = await b.client
      .from("household_memberships")
      .select("id, household_id, user_id");
    memB = bMemberships!.find(
      (row) => row.household_id === householdSelect && row.user_id === b.userId,
    )!.id;
    memBReceipt = bMemberships!.find(
      (row) => row.household_id === householdReceipt && row.user_id === b.userId,
    )!.id;

    for (const [index, merchant] of ["Walmart", "Electricity", "Supplies"].entries()) {
      selectedObligationIds.push(
        await confirmSharedExpense(a.client, {
          householdId: householdSelect,
          payerMembershipId: memA,
          debtorMembershipId: memB,
          merchant,
          declaredTotalCents: 1000 + index * 200,
          idempotencyKey: `e2e-sel-exp-${runId}-${index}`,
        }),
      );
    }
    await confirmSharedExpense(a.client, {
      householdId: householdReceipt,
      payerMembershipId: memAReceipt,
      debtorMembershipId: memBReceipt,
      merchant: "Rent share",
      declaredTotalCents: 10000,
      idempotencyKey: `e2e-rec-exp-${runId}`,
    });
  });

  test.afterAll(async () => {
    if (admin) {
      await cleanupTestHouseholdsByRunId(admin, runId);
      await deleteTestAuthUsers(admin, createdUserIds);
    }
  });

  test("selecting every eligible expense submits those ids", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "Desktop Chrome");
    await page.addInitScript(() => {
      localStorage.setItem("householdos-theme", "dark");
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, emailB);
    await page.goto(`/app/${householdSelect}/money/payments/new?direction=sent`);
    await expect(page.getByTestId("settle-up-form")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByTestId("pair-balance")).toBeVisible();

    await page.getByTestId("choose-expenses").click();
    await expect(page.getByTestId("empty-selection")).toHaveText(
      "Select at least one expense to settle.",
    );
    await page.getByTestId("select-all").click({ force: true });
    await expect(page.getByTestId("selection-summary")).toHaveText("3 expenses selected");
    await expect(page.getByTestId("selected-total")).toBeVisible();
    const selectedRaw = await page.getByTestId("allocations-json").inputValue();
    const selectedIds = (
      JSON.parse(selectedRaw) as Array<{ obligationId: string }>
    )
      .map((row) => row.obligationId)
      .sort();
    expect(selectedIds).toEqual([...selectedObligationIds].sort());

    await page.getByTestId("deselect-all").click();
    await expect(page.getByTestId("selection-summary")).toHaveText("0 expenses selected");
    await expect(page.getByTestId("submit-payment")).toBeDisabled();

    await page.getByTestId("select-all").click({ force: true });
    await expect(page.getByTestId("selection-summary")).toHaveText("3 expenses selected");
    await page.getByTestId(`expense-details-${selectedObligationIds[0]}`).click({ force: true });
    await expect(page.getByTestId(`obligation-select-${selectedObligationIds[0]}`)).toBeChecked();

    await page.getByTestId("acknowledge-external").check();
    await page.getByTestId("submit-payment").click();
    await page.waitForURL(new RegExp(`/app/${householdSelect}/money/payments/[0-9a-f-]{36}$`), {
      timeout: 30_000,
    });
    await expect(page.getByText("Select at least one")).toHaveCount(0);
    await expect(page.getByTestId("payment-narrative")).toContainText("reported sending");

    const { data: allocations } = await admin
      .from("payment_allocations")
      .select("obligation_id")
      .in("obligation_id", selectedObligationIds);
    expect((allocations ?? []).map((row) => row.obligation_id).sort()).toEqual(
      [...selectedObligationIds].sort(),
    );
  });

  test("recipient records the full balance without the payer approving", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "Desktop Chrome");
    await page.addInitScript(() => {
      localStorage.setItem("householdos-theme", "light");
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, emailA);
    await page.goto(
      `/app/${householdReceipt}/money/payments/new?direction=received&counterparty=${memBReceipt}`,
    );
    await expect(page.getByTestId("settle-up-form")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await page.getByTestId("settle-entire-balance").click();
    await expect(page.getByTestId("selection-summary")).toContainText("selected");
    await page.getByTestId("acknowledge-external").check();
    await page.getByTestId("record-received").click();
    await page.waitForURL(new RegExp(`/app/${householdReceipt}/money/payments/[0-9a-f-]{36}$`), {
      timeout: 30_000,
    });
    await expect(page.getByTestId("payment-narrative")).toContainText("recorded receiving");

    const { data: balance } = await admin
      .from("obligation_balances_v")
      .select("official_outstanding_cents")
      .eq("household_id", householdReceipt);
    expect((balance ?? []).every((row) => row.official_outstanding_cents === 0)).toBe(true);

    const { data: otherHouse } = await admin
      .from("payments")
      .select("id")
      .eq("household_id", householdSelect)
      .eq("status", "confirmed");
    expect(otherHouse ?? []).toHaveLength(0);

    const { data: settled } = await admin
      .from("reimbursement_obligations")
      .select("id")
      .eq("household_id", householdReceipt)
      .limit(1)
      .single();
    await page.goto(`/app/${householdReceipt}/money/reimbursements/${settled!.id}`);
    await expect(page.getByText("How was this calculated?")).toBeVisible({ timeout: 20_000 });
  });
});
