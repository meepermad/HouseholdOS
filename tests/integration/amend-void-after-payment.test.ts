import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calculateExpense } from "@/lib/expenses";
import { generateInviteToken, hashInviteToken } from "@/lib/tokens";
import type { Database, Json } from "@/types/database";
import { getAuthedClient } from "../helpers/authed-client";
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
const runId = `avp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = "Test-Password-123!";

type Admin = SupabaseClient<Database>;

function authed(email: string) {
  return getAuthedClient(email, password);
}

describe.skipIf(!hasSupabase)("amend/void after payment", () => {
  let admin: Admin;
  const createdUserIds: string[] = [];
  let householdId = "";
  let memA = "";
  let memB = "";
  let expenseId = "";
  let oblB = "";
  let emailA = "";
  let emailB = "";

  beforeAll(async () => {
    admin = createClient<Database>(url!, secretKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await admin.from("auth_registration_policy").upsert({
      id: 1,
      mode: "invite_only",
      allow_test_emails: true,
      test_email_domain: TEST_DOMAIN,
    });
    emailA = `ava-${runId}@${TEST_DOMAIN}`;
    emailB = `avb-${runId}@${TEST_DOMAIN}`;
    for (const email of [emailA, emailB]) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(created.error).toBeNull();
      createdUserIds.push(created.data.user!.id);
    }

    const a = await authed(emailA);
    const created = await a.client.rpc("create_household", {
      p_name: `AVP-${runId}`,
      p_acknowledge_reimbursement_policy: true,
    });
    householdId = created.data as string;
    const { data: mA } = await a.client
      .from("household_memberships")
      .select("id")
      .eq("household_id", householdId)
      .eq("user_id", a.userId)
      .single();
    memA = mA!.id;

    const token = generateInviteToken();
    await a.client.rpc("create_household_invitation", {
      p_household_id: householdId,
      p_email: emailB,
      p_token_hash: hashInviteToken(token),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_intended_roles: ["member"],
    });
    const b = await authed(emailB);
    await b.client.rpc("accept_household_invitation", {
      p_token_hash: hashInviteToken(token),
    });
    const { data: mB } = await b.client
      .from("household_memberships")
      .select("id")
      .eq("household_id", householdId)
      .eq("user_id", b.userId)
      .single();
    memB = mB!.id;

    const { data: draft } = await a.client
      .from("expenses")
      .insert({
        household_id: householdId,
        created_by_membership_id: memA,
        payer_membership_id: memA,
        merchant: "AVP Mart",
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
    if (!calc.ok) return;
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
          p_idempotency_key: `avp-exp-${runId}`,
          p_snapshot: snapshot,
        })
      ).error,
    ).toBeNull();
    const { data: obls } = await a.client
      .from("reimbursement_obligations")
      .select("id, debtor_membership_id")
      .eq("expense_id", expenseId);
    oblB = (obls ?? []).find((o) => o.debtor_membership_id === memB)!.id;
  }, 180_000);

  afterAll(async () => {
    if (!admin) return;
    await cleanupTestHouseholdsByRunId(admin, runId);
    await deleteTestAuthUsers(admin, createdUserIds);
  }, 180_000);

  it("blocks void while a submitted payment is pending and names the payment", async () => {
    const b = await authed(emailB);
    const submitted = await b.client.rpc("submit_payment", {
      p_household_id: householdId,
      p_recipient_membership_id: memA,
      p_total_amount_cents: 200,
      p_external_method: "cash",
      p_allocations: [{ obligation_id: oblB, amount_cents: 200 }] as unknown as Json,
      p_idempotency_key: `avp-block-${runId}`,
    });
    expect(submitted.error).toBeNull();
    const paymentId = (submitted.data as { id: string }).id;

    const a = await authed(emailA);
    const voided = await a.client.rpc("void_expense", {
      p_expense_id: expenseId,
      p_reason: "should block",
    });
    expect(voided.error).toBeTruthy();
    expect(voided.error!.message).toMatch(/submitted payment/i);
    expect(voided.error!.message).toContain(paymentId);

    expect(
      (await b.client.rpc("cancel_payment", { p_payment_id: paymentId })).error,
    ).toBeNull();
  });

  it("void after confirmed payment creates a refund obligation for paid cents", async () => {
    const b = await authed(emailB);
    const submitted = await b.client.rpc("submit_payment", {
      p_household_id: householdId,
      p_recipient_membership_id: memA,
      p_total_amount_cents: 500,
      p_external_method: "zelle",
      p_allocations: [{ obligation_id: oblB, amount_cents: 500 }] as unknown as Json,
      p_idempotency_key: `avp-full-${runId}`,
    });
    expect(submitted.error).toBeNull();
    const paymentId = (submitted.data as { id: string }).id;
    const a = await authed(emailA);
    expect(
      (await a.client.rpc("confirm_payment", { p_payment_id: paymentId })).error,
    ).toBeNull();

    expect(
      (
        await a.client.rpc("void_expense", {
          p_expense_id: expenseId,
          p_reason: "duplicate receipt",
        })
      ).error,
    ).toBeNull();

    const { data: refunds } = await a.client
      .from("reimbursement_obligations")
      .select("id, obligation_kind, current_amount_cents, debtor_membership_id, creditor_membership_id")
      .eq("household_id", householdId)
      .eq("obligation_kind", "refund");
    expect((refunds ?? []).length).toBeGreaterThan(0);
    const refund = refunds![0]!;
    expect(refund.current_amount_cents).toBe(500);
    // Original debtor was B; after void, A owes B a refund.
    expect(refund.debtor_membership_id).toBe(memA);
    expect(refund.creditor_membership_id).toBe(memB);

    const { data: original } = await a.client
      .from("obligation_balances_v")
      .select("official_outstanding_cents")
      .eq("obligation_id", oblB)
      .single();
    expect(original?.official_outstanding_cents).toBe(0);
  });
});
