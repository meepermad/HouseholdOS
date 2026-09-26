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
const password = "Test-Password-123!";
const runId = `recv-${Date.now().toString(36)}`;

type Session = Awaited<ReturnType<typeof getAuthedClient>>;

async function confirmSharedExpense(
  client: Session["client"],
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
  expect(draftError).toBeNull();
  const expenseId = draft!.id;
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
  expect(itemError).toBeNull();
  expect(
    (
      await client.from("expense_item_allocations").insert([
        {
          item_id: item!.id,
          expense_id: expenseId,
          household_id: args.householdId,
          membership_id: args.payerMembershipId,
          amount_cents: 0,
        },
        {
          item_id: item!.id,
          expense_id: expenseId,
          household_id: args.householdId,
          membership_id: args.debtorMembershipId,
          amount_cents: 0,
        },
      ])
    ).error,
  ).toBeNull();
  const calc = calculateExpense({
    payerMembershipId: args.payerMembershipId,
    eligibleMembershipIds: [args.payerMembershipId, args.debtorMembershipId],
    currency: "USD",
    householdCurrency: "USD",
    declaredTotalCents: args.declaredTotalCents,
    items: [
      {
        id: item!.id,
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
  expect(calc.ok).toBe(true);
  if (!calc.ok) throw new Error("calc failed");
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
  expect(
    (
      await client.rpc("confirm_expense", {
        p_expense_id: expenseId,
        p_idempotency_key: args.idempotencyKey,
        p_snapshot: snapshot,
      })
    ).error,
  ).toBeNull();
  const { data: obligations } = await client
    .from("reimbursement_obligations")
    .select("id, debtor_membership_id, current_amount_cents")
    .eq("expense_id", expenseId);
  const debtor = (obligations ?? []).find(
    (row) => row.debtor_membership_id === args.debtorMembershipId,
  );
  if (!debtor) throw new Error("missing obligation");
  return { obligationId: debtor.id, amountCents: debtor.current_amount_cents };
}

describe.skipIf(!hasSupabase)("recipient-recorded payments", () => {
  let admin: SupabaseClient<Database>;
  const createdUserIds: string[] = [];
  let householdId = "";
  let otherHouseholdId = "";
  let memA = "";
  let memB = "";
  let memC = "";
  let emailA = "";
  let emailB = "";
  let emailC = "";
  let full: { obligationId: string; amountCents: number };
  let partial: { obligationId: string; amountCents: number };
  let matched: { obligationId: string; amountCents: number };
  let overpay: { obligationId: string; amountCents: number };
  let disputed: { obligationId: string; amountCents: number };
  let concurrent: { obligationId: string; amountCents: number };

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
    emailA = `recv-a-${runId}@${TEST_DOMAIN}`;
    emailB = `recv-b-${runId}@${TEST_DOMAIN}`;
    emailC = `recv-c-${runId}@${TEST_DOMAIN}`;
    for (const [email, name] of [
      [emailA, "Atem"],
      [emailB, "Andrew"],
      [emailC, "Casey"],
    ] as const) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(created.error).toBeNull();
      createdUserIds.push(created.data.user!.id);
      await admin
        .from("profiles")
        .update({ display_name: name })
        .eq("id", created.data.user!.id);
    }

    const a = await getAuthedClient(emailA, password);
    const created = await a.client.rpc("create_household", {
      p_name: `Recv ${runId}`,
      p_acknowledge_reimbursement_policy: true,
    });
    expect(created.error).toBeNull();
    householdId = created.data as string;
    const token = generateInviteToken();
    await a.client.rpc("create_household_invitation", {
      p_household_id: householdId,
      p_email: emailB,
      p_token_hash: hashInviteToken(token),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_intended_roles: ["member"],
    });
    const b = await getAuthedClient(emailB, password);
    expect(
      (
        await b.client.rpc("accept_household_invitation", {
          p_token_hash: hashInviteToken(token),
        })
      ).error,
    ).toBeNull();
    const tokenC = generateInviteToken();
    await a.client.rpc("create_household_invitation", {
      p_household_id: householdId,
      p_email: emailC,
      p_token_hash: hashInviteToken(tokenC),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_intended_roles: ["member"],
    });
    const c = await getAuthedClient(emailC, password);
    expect(
      (
        await c.client.rpc("accept_household_invitation", {
          p_token_hash: hashInviteToken(tokenC),
        })
      ).error,
    ).toBeNull();

    const { data: memberships } = await a.client
      .from("household_memberships")
      .select("id, user_id")
      .eq("household_id", householdId);
    memA = memberships!.find((row) => row.user_id === a.userId)!.id;
    memB = memberships!.find((row) => row.user_id === b.userId)!.id;
    memC = memberships!.find((row) => row.user_id === c.userId)!.id;

    const other = await c.client.rpc("create_household", {
      p_name: `Recv other ${runId}`,
      p_acknowledge_reimbursement_policy: true,
    });
    expect(other.error).toBeNull();
    otherHouseholdId = other.data as string;

    full = await confirmSharedExpense(a.client, {
      householdId,
      payerMembershipId: memA,
      debtorMembershipId: memB,
      merchant: "Full",
      declaredTotalCents: 10000,
      idempotencyKey: `recv-full-exp-${runId}`,
    });
    partial = await confirmSharedExpense(a.client, {
      householdId,
      payerMembershipId: memA,
      debtorMembershipId: memB,
      merchant: "Partial",
      declaredTotalCents: 16000,
      idempotencyKey: `recv-part-exp-${runId}`,
    });
    matched = await confirmSharedExpense(a.client, {
      householdId,
      payerMembershipId: memA,
      debtorMembershipId: memB,
      merchant: "Matched",
      declaredTotalCents: 5000,
      idempotencyKey: `recv-match-exp-${runId}`,
    });
    overpay = await confirmSharedExpense(a.client, {
      householdId,
      payerMembershipId: memA,
      debtorMembershipId: memB,
      merchant: "Over",
      declaredTotalCents: 3000,
      idempotencyKey: `recv-over-exp-${runId}`,
    });
    disputed = await confirmSharedExpense(a.client, {
      householdId,
      payerMembershipId: memA,
      debtorMembershipId: memB,
      merchant: "Dispute",
      declaredTotalCents: 4000,
      idempotencyKey: `recv-disp-exp-${runId}`,
    });
    concurrent = await confirmSharedExpense(a.client, {
      householdId,
      payerMembershipId: memA,
      debtorMembershipId: memB,
      merchant: "Race",
      declaredTotalCents: 2000,
      idempotencyKey: `recv-race-exp-${runId}`,
    });
    expect(full.amountCents).toBe(5000);
    expect(partial.amountCents).toBe(8000);
  });

  afterAll(async () => {
    if (!admin) return;
    await cleanupTestHouseholdsByRunId(admin, runId);
    await deleteTestAuthUsers(admin, createdUserIds);
  });

  async function outstanding(obligationId: string) {
    const { data, error } = await admin
      .from("obligation_balances_v")
      .select("official_outstanding_cents")
      .eq("obligation_id", obligationId)
      .single();
    expect(error).toBeNull();
    return data!.official_outstanding_cents ?? 0;
  }

  it("lets the recipient settle the full balance and ignores a duplicate submit", async () => {
    const a = await getAuthedClient(emailA, password);
    const key = `recv-full-${runId}`;
    const first = await a.client.rpc("record_received_payment", {
      p_household_id: householdId,
      p_payer_membership_id: memB,
      p_total_amount_cents: full.amountCents,
      p_external_method: "venmo",
      p_allocations: [
        { obligation_id: full.obligationId, amount_cents: full.amountCents },
      ] as unknown as Json,
      p_idempotency_key: key,
    });
    expect(first.error).toBeNull();
    const paymentId = (first.data as { id: string }).id;
    const second = await a.client.rpc("record_received_payment", {
      p_household_id: householdId,
      p_payer_membership_id: memB,
      p_total_amount_cents: full.amountCents,
      p_external_method: "venmo",
      p_allocations: [
        { obligation_id: full.obligationId, amount_cents: full.amountCents },
      ] as unknown as Json,
      p_idempotency_key: key,
    });
    expect(second.error).toBeNull();
    expect((second.data as { id: string }).id).toBe(paymentId);
    expect(await outstanding(full.obligationId)).toBe(0);

    const { data: payment } = await admin
      .from("payments")
      .select("status, created_by_membership_id, confirmed_by_membership_id, sender_membership_id")
      .eq("id", paymentId)
      .single();
    expect(payment?.status).toBe("confirmed");
    expect(payment?.created_by_membership_id).toBe(memA);
    expect(payment?.confirmed_by_membership_id).toBe(memA);
    expect(payment?.sender_membership_id).toBe(memB);

    const b = await getAuthedClient(emailB, password);
    const { data: notes } = await b.client
      .from("user_notifications")
      .select("title, body")
      .eq("user_id", b.userId);
    expect(
      (notes ?? []).some((row) => row.body.includes("recorded receiving your $50.00 payment")),
    ).toBe(true);

    const payerRetry = await b.client.rpc("submit_payment", {
      p_household_id: householdId,
      p_recipient_membership_id: memA,
      p_total_amount_cents: full.amountCents,
      p_external_method: "venmo",
      p_allocations: [
        { obligation_id: full.obligationId, amount_cents: full.amountCents },
      ] as unknown as Json,
      p_idempotency_key: `recv-full-payer-${runId}`,
    });
    expect(payerRetry.error).not.toBeNull();
    const associated = await b.client.rpc("associate_payer_report", {
      p_payment_id: paymentId,
      p_idempotency_key: `recv-assoc-${runId}`,
      p_note: "Same Venmo payment",
    });
    expect(associated.error).toBeNull();
    const { count } = await admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .eq("sender_membership_id", memB)
      .eq("total_amount_cents", full.amountCents);
    expect(count).toBe(1);
    expect(await outstanding(full.obligationId)).toBe(0);
  });

  it("applies a partial receipt and leaves the remainder", async () => {
    const a = await getAuthedClient(emailA, password);
    const recorded = await a.client.rpc("record_received_payment", {
      p_household_id: householdId,
      p_payer_membership_id: memB,
      p_total_amount_cents: 3500,
      p_external_method: "cash",
      p_allocations: [{ obligation_id: partial.obligationId, amount_cents: 3500 }] as unknown as Json,
      p_idempotency_key: `recv-part-${runId}`,
    });
    expect(recorded.error).toBeNull();
    expect(await outstanding(partial.obligationId)).toBe(4500);
    const paymentId = (recorded.data as { id: string }).id;
    const { data: allocation } = await admin
      .from("payment_allocations")
      .select("amount_cents, obligation_id")
      .eq("payment_id", paymentId)
      .single();
    expect(allocation?.obligation_id).toBe(partial.obligationId);
    expect(allocation?.amount_cents).toBe(3500);
  });

  it("confirms a matching payer report in place instead of creating a second settlement", async () => {
    const b = await getAuthedClient(emailB, password);
    const submitted = await b.client.rpc("submit_payment", {
      p_household_id: householdId,
      p_recipient_membership_id: memA,
      p_total_amount_cents: matched.amountCents,
      p_external_method: "zelle",
      p_allocations: [
        { obligation_id: matched.obligationId, amount_cents: matched.amountCents },
      ] as unknown as Json,
      p_idempotency_key: `recv-match-submit-${runId}`,
    });
    expect(submitted.error).toBeNull();
    const paymentId = (submitted.data as { id: string }).id;
    expect(await outstanding(matched.obligationId)).toBe(matched.amountCents);

    const a = await getAuthedClient(emailA, password);
    const recorded = await a.client.rpc("record_received_payment", {
      p_household_id: householdId,
      p_payer_membership_id: memB,
      p_total_amount_cents: matched.amountCents,
      p_external_method: "zelle",
      p_allocations: [
        { obligation_id: matched.obligationId, amount_cents: matched.amountCents },
      ] as unknown as Json,
      p_idempotency_key: `recv-match-record-${runId}`,
    });
    expect(recorded.error).toBeNull();
    expect((recorded.data as { id: string }).id).toBe(paymentId);
    const { data: payment } = await admin
      .from("payments")
      .select("status, created_by_membership_id, confirmed_by_membership_id")
      .eq("id", paymentId)
      .single();
    expect(payment?.status).toBe("confirmed");
    expect(payment?.created_by_membership_id).toBe(memB);
    expect(payment?.confirmed_by_membership_id).toBe(memA);
    expect(await outstanding(matched.obligationId)).toBe(0);
    const { count } = await admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("id", paymentId);
    expect(count).toBe(1);
    const { data: events } = await admin
      .from("notification_events")
      .select("idempotency_key")
      .eq("entity_id", paymentId)
      .eq("event_type", "payment.confirmed");
    expect(events ?? []).toHaveLength(1);
  });

  it("rejects overpayment, the wrong payer, and a cross-household attempt", async () => {
    const a = await getAuthedClient(emailA, password);
    const before = await outstanding(overpay.obligationId);
    const over = await a.client.rpc("record_received_payment", {
      p_household_id: householdId,
      p_payer_membership_id: memB,
      p_total_amount_cents: before + 1,
      p_external_method: "cash",
      p_allocations: [
        { obligation_id: overpay.obligationId, amount_cents: before + 1 },
      ] as unknown as Json,
      p_idempotency_key: `recv-over-${runId}`,
    });
    expect(over.error?.message ?? "").toMatch(/outstanding|Invalid payment amount/i);
    expect(await outstanding(overpay.obligationId)).toBe(before);

    const wrongPayer = await a.client.rpc("record_received_payment", {
      p_household_id: householdId,
      p_payer_membership_id: memC,
      p_total_amount_cents: before,
      p_external_method: "cash",
      p_allocations: [
        { obligation_id: overpay.obligationId, amount_cents: before },
      ] as unknown as Json,
      p_idempotency_key: `recv-wrong-${runId}`,
    });
    expect(wrongPayer.error).not.toBeNull();

    const c = await getAuthedClient(emailC, password);
    const cross = await c.client.rpc("record_received_payment", {
      p_household_id: otherHouseholdId,
      p_payer_membership_id: memB,
      p_total_amount_cents: before,
      p_external_method: "cash",
      p_allocations: [
        { obligation_id: overpay.obligationId, amount_cents: before },
      ] as unknown as Json,
      p_idempotency_key: `recv-cross-${runId}`,
    });
    expect(cross.error).not.toBeNull();
    expect(await outstanding(overpay.obligationId)).toBe(before);

    const { count } = await admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("household_id", otherHouseholdId);
    expect(count).toBe(0);
  });

  it("keeps a dispute from reversing the balance and preserves history on correction", async () => {
    const a = await getAuthedClient(emailA, password);
    const recorded = await a.client.rpc("record_received_payment", {
      p_household_id: householdId,
      p_payer_membership_id: memB,
      p_total_amount_cents: disputed.amountCents,
      p_external_method: "bank_transfer",
      p_allocations: [
        { obligation_id: disputed.obligationId, amount_cents: disputed.amountCents },
      ] as unknown as Json,
      p_idempotency_key: `recv-disp-${runId}`,
    });
    expect(recorded.error).toBeNull();
    const paymentId = (recorded.data as { id: string }).id;
    expect(await outstanding(disputed.obligationId)).toBe(0);

    const b = await getAuthedClient(emailB, password);
    const dispute = await b.client.rpc("open_dispute", {
      p_household_id: householdId,
      p_dispute_type: "payment_not_received",
      p_reason: "I did not send this",
      p_payment_id: paymentId,
    });
    expect(dispute.error).toBeNull();
    expect(await outstanding(disputed.obligationId)).toBe(0);
    const { data: disputeRow } = await admin
      .from("reimbursement_disputes")
      .select("status, raised_by_membership_id, reason")
      .eq("payment_id", paymentId)
      .single();
    expect(disputeRow?.status).toBe("open");
    expect(disputeRow?.raised_by_membership_id).toBe(memB);
    expect(disputeRow?.reason).toBe("I did not send this");

    const reversed = await a.client.rpc("reverse_payment", {
      p_payment_id: paymentId,
      p_reason: "Recorded the wrong amount",
    });
    expect(reversed.error).toBeNull();
    expect(await outstanding(disputed.obligationId)).toBe(disputed.amountCents);
    const { data: payment } = await admin
      .from("payments")
      .select("status, total_amount_cents")
      .eq("id", paymentId)
      .single();
    expect(payment?.status).toBe("reversed");
    expect(payment?.total_amount_cents).toBe(disputed.amountCents);
    const { data: audit } = await admin
      .from("audit_events")
      .select("event_type")
      .eq("entity_id", paymentId);
    expect((audit ?? []).map((row) => row.event_type)).toEqual(
      expect.arrayContaining(["payment.recipient_recorded", "payment.reversed"]),
    );
  });

  it("serializes two concurrent receipts into one settlement", async () => {
    const a = await getAuthedClient(emailA, password);
    const args = {
      p_household_id: householdId,
      p_payer_membership_id: memB,
      p_total_amount_cents: concurrent.amountCents,
      p_external_method: "cash" as const,
      p_allocations: [
        { obligation_id: concurrent.obligationId, amount_cents: concurrent.amountCents },
      ] as unknown as Json,
    };
    const [first, second] = await Promise.all([
      a.client.rpc("record_received_payment", {
        ...args,
        p_idempotency_key: `recv-race-a-${runId}`,
      }),
      a.client.rpc("record_received_payment", {
        ...args,
        p_idempotency_key: `recv-race-b-${runId}`,
      }),
    ]);
    const successes = [first, second].filter((result) => result.error === null);
    expect(successes).toHaveLength(1);
    expect(await outstanding(concurrent.obligationId)).toBe(0);
    const { count } = await admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .eq("total_amount_cents", concurrent.amountCents);
    expect(count).toBe(1);
  });

  it("rejects a removed member and an outsider", async () => {
    const a = await getAuthedClient(emailA, password);
    const c = await getAuthedClient(emailC, password);
    expect(
      (
        await a.client.rpc("remove_household_member", {
          p_household_id: householdId,
          p_membership_id: memC,
          p_reason: "moved",
        })
      ).error,
    ).toBeNull();
    const removed = await a.client.rpc("record_received_payment", {
      p_household_id: householdId,
      p_payer_membership_id: memC,
      p_total_amount_cents: 100,
      p_external_method: "cash",
      p_allocations: [{ obligation_id: overpay.obligationId, amount_cents: 100 }] as unknown as Json,
      p_idempotency_key: `recv-removed-${runId}`,
    });
    expect(removed.error?.message ?? "").toMatch(/Removed member|Invalid payer/i);

    const outsider = await c.client.rpc("record_received_payment", {
      p_household_id: householdId,
      p_payer_membership_id: memB,
      p_total_amount_cents: overpay.amountCents,
      p_external_method: "cash",
      p_allocations: [
        { obligation_id: overpay.obligationId, amount_cents: overpay.amountCents },
      ] as unknown as Json,
      p_idempotency_key: `recv-outsider-${runId}`,
    });
    expect(outsider.error).not.toBeNull();
  });
});
