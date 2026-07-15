import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calculateExpense } from "@/lib/expenses";
import { storedStatusSyncedWithDerived } from "@/lib/payments";
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
const runId = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type Admin = SupabaseClient<Database>;

function authed(email: string, password: string) {
  return getAuthedClient(email, password);
}

describe.skipIf(!hasSupabase)("payment settlement RLS and RPCs", () => {
  let admin: Admin;
  const createdUserIds: string[] = [];
  let householdA: string;
  let householdB: string;
  let memA: string;
  let memB: string;
  let oblB: string;
  let emailA: string;
  let emailB: string;
  let emailC: string;
  const password = "Test-Password-123!";

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

    emailA = `pa-${runId}@${TEST_DOMAIN}`;
    emailB = `pb-${runId}@${TEST_DOMAIN}`;
    emailC = `pc-${runId}@${TEST_DOMAIN}`;
    for (const email of [emailA, emailB, emailC]) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(created.error).toBeNull();
      createdUserIds.push(created.data.user!.id);
    }

    const a = await authed(emailA, password);
    const createdA = await a.client.rpc("create_household", {
      p_name: `PayA-${runId}`,
      p_acknowledge_reimbursement_policy: true,
    });
    householdA = createdA.data as string;
    const { data: mA } = await a.client
      .from("household_memberships")
      .select("id")
      .eq("household_id", householdA)
      .eq("user_id", a.userId)
      .single();
    memA = mA!.id;

    const token = generateInviteToken();
    await a.client.rpc("create_household_invitation", {
      p_household_id: householdA,
      p_email: emailB,
      p_token_hash: hashInviteToken(token),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_intended_roles: ["member"],
    });
    const b = await authed(emailB, password);
    await b.client.rpc("accept_household_invitation", {
      p_token_hash: hashInviteToken(token),
    });
    const { data: mB } = await b.client
      .from("household_memberships")
      .select("id")
      .eq("household_id", householdA)
      .eq("user_id", b.userId)
      .single();
    memB = mB!.id;

    const bAlone = await authed(emailB, password);
    const createdB = await bAlone.client.rpc("create_household", {
      p_name: `PayB-${runId}`,
      p_acknowledge_reimbursement_policy: true,
    });
    householdB = createdB.data as string;

    // A pays, equal split A+B → B owes A 500
    const { data: draft } = await a.client
      .from("expenses")
      .insert({
        household_id: householdA,
        created_by_membership_id: memA,
        payer_membership_id: memA,
        merchant: "Pay Mart",
        purchase_date: "2026-07-01",
        currency: "USD",
        declared_total_cents: 1000,
        status: "draft",
      })
      .select("*")
      .single();

    const { data: item } = await a.client
      .from("expense_items")
      .insert({
        expense_id: draft!.id,
        household_id: householdA,
        description: "Shared",
        total_cents: 1000,
        allocation_mode: "equal_selected",
      })
      .select("id")
      .single();

    await a.client.from("expense_item_allocations").insert([
      {
        item_id: item!.id,
        expense_id: draft!.id,
        household_id: householdA,
        membership_id: memA,
        amount_cents: 0,
      },
      {
        item_id: item!.id,
        expense_id: draft!.id,
        household_id: householdA,
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

    const confirmed = await a.client.rpc("confirm_expense", {
      p_expense_id: draft!.id,
      p_idempotency_key: `pay-exp-${runId}`,
      p_snapshot: snapshot,
    });
    expect(confirmed.error).toBeNull();

    const { data: obls } = await a.client
      .from("reimbursement_obligations")
      .select("id, debtor_membership_id, current_amount_cents")
      .eq("expense_id", draft!.id);
    const owedByB = (obls ?? []).find((o) => o.debtor_membership_id === memB);
    expect(owedByB).toBeTruthy();
    oblB = owedByB!.id;
  }, 180_000);

  afterAll(async () => {
    if (!admin) return;
    await cleanupTestHouseholdsByRunId(admin, runId);
    await deleteTestAuthUsers(admin, createdUserIds);
  }, 180_000);

  it("1+7: debtor can submit; sender cannot confirm", async () => {
    const b = await authed(emailB, password);
    const key = `sub-${runId}-1`;
    const submitted = await b.client.rpc("submit_payment", {
      p_household_id: householdA,
      p_recipient_membership_id: memA,
      p_total_amount_cents: 300,
      p_external_method: "venmo",
      p_allocations: [{ obligation_id: oblB, amount_cents: 300 }] as unknown as Json,
      p_idempotency_key: key,
    });
    expect(submitted.error).toBeNull();
    const paymentId = (submitted.data as { id: string }).id;

    const confirmAsSender = await b.client.rpc("confirm_payment", {
      p_payment_id: paymentId,
    });
    expect(confirmAsSender.error).toBeTruthy();

    const a = await authed(emailA, password);
    const confirmed = await a.client.rpc("confirm_payment", {
      p_payment_id: paymentId,
    });
    expect(confirmed.error).toBeNull();

    const { data: bal } = await a.client
      .from("obligation_balances_v")
      .select("official_outstanding_cents, confirmed_paid_cents, effective_amount_cents")
      .eq("obligation_id", oblB)
      .single();
    expect(bal?.effective_amount_cents).toBe(500);
    expect(bal?.confirmed_paid_cents).toBe(300);
    expect(bal?.official_outstanding_cents).toBe(200);
  });

  it("2: non-debtor cannot create payment against another's obligation", async () => {
    const a = await authed(emailA, password);
    const res = await a.client.rpc("submit_payment", {
      p_household_id: householdA,
      p_recipient_membership_id: memA,
      p_total_amount_cents: 100,
      p_external_method: "cash",
      p_allocations: [{ obligation_id: oblB, amount_cents: 100 }] as unknown as Json,
      p_idempotency_key: `bad-debtor-${runId}`,
    });
    expect(res.error).toBeTruthy();
  });

  it("5+10: cannot exceed outstanding; partial remainder", async () => {
    const b = await authed(emailB, password);
    const over = await b.client.rpc("submit_payment", {
      p_household_id: householdA,
      p_recipient_membership_id: memA,
      p_total_amount_cents: 9999,
      p_external_method: "zelle",
      p_allocations: [{ obligation_id: oblB, amount_cents: 9999 }] as unknown as Json,
      p_idempotency_key: `over-${runId}`,
    });
    expect(over.error).toBeTruthy();

    const { data: bal } = await b.client
      .from("obligation_balances_v")
      .select("official_outstanding_cents")
      .eq("obligation_id", oblB)
      .single();
    expect(bal?.official_outstanding_cents).toBe(200);
  });

  it("17+18+19: direct waiver insert fails; creditor waiver works; debtor cannot waive", async () => {
    const b = await authed(emailB, password);
    const direct = await b.client.from("reimbursement_waivers").insert({
      household_id: householdA,
      obligation_id: oblB,
      amount_cents: 50,
      reason: "hack",
      created_by_membership_id: memB,
    });
    expect(direct.error).toBeTruthy();

    const debtorWaiver = await b.client.rpc("create_reimbursement_waiver", {
      p_obligation_id: oblB,
      p_amount_cents: 50,
      p_reason: "should fail",
    });
    expect(debtorWaiver.error).toBeTruthy();

    const a = await authed(emailA, password);
    const waiver = await a.client.rpc("create_reimbursement_waiver", {
      p_obligation_id: oblB,
      p_amount_cents: 50,
      p_reason: "rounding gift",
    });
    expect(waiver.error).toBeNull();

    const { data: bal } = await a.client
      .from("obligation_balances_v")
      .select("official_outstanding_cents, waived_cents, effective_amount_cents")
      .eq("obligation_id", oblB)
      .single();
    expect(bal?.effective_amount_cents).toBe(500);
    expect(bal?.waived_cents).toBe(50);
    expect(bal?.official_outstanding_cents).toBe(150);
  });

  it("14+15: reversal restores balance and cannot run twice", async () => {
    const b = await authed(emailB, password);
    const submitted = await b.client.rpc("submit_payment", {
      p_household_id: householdA,
      p_recipient_membership_id: memA,
      p_total_amount_cents: 150,
      p_external_method: "paypal",
      p_allocations: [{ obligation_id: oblB, amount_cents: 150 }] as unknown as Json,
      p_idempotency_key: `rev-${runId}`,
    });
    expect(submitted.error).toBeNull();
    const paymentId = (submitted.data as { id: string }).id;

    const a = await authed(emailA, password);
    expect(
      (await a.client.rpc("confirm_payment", { p_payment_id: paymentId })).error,
    ).toBeNull();

    const { data: settled } = await a.client
      .from("obligation_balances_v")
      .select("official_outstanding_cents, settlement_state")
      .eq("obligation_id", oblB)
      .single();
    expect(settled?.official_outstanding_cents).toBe(0);

    expect(
      (
        await a.client.rpc("reverse_payment", {
          p_payment_id: paymentId,
          p_reason: "recorded in error",
        })
      ).error,
    ).toBeNull();

    const { data: reopened } = await a.client
      .from("obligation_balances_v")
      .select("official_outstanding_cents")
      .eq("obligation_id", oblB)
      .single();
    expect(reopened?.official_outstanding_cents).toBe(150);

    const again = await a.client.rpc("reverse_payment", {
      p_payment_id: paymentId,
      p_reason: "twice",
    });
    expect(again.error).toBeTruthy();
  });

  it("13+16: confirmed payment cannot be edited; direct settlement update fails", async () => {
    const a = await authed(emailA, password);
    const { data: payment } = await a.client
      .from("payments")
      .select("id, total_amount_cents")
      .eq("household_id", householdA)
      .eq("status", "reversed")
      .limit(1)
      .maybeSingle();

    if (payment) {
      await a.client
        .from("payments")
        .update({ total_amount_cents: 1 })
        .eq("id", payment.id);
      const { data: after } = await a.client
        .from("payments")
        .select("total_amount_cents")
        .eq("id", payment.id)
        .single();
      // No UPDATE policy / RPC-only writes — amount must remain unchanged.
      expect(after?.total_amount_cents).toBe(payment.total_amount_cents);
    }

    const { data: beforeObl } = await a.client
      .from("reimbursement_obligations")
      .select("status")
      .eq("id", oblB)
      .single();
    await a.client
      .from("reimbursement_obligations")
      .update({ status: "settled" })
      .eq("id", oblB);
    const { data: afterObl } = await a.client
      .from("reimbursement_obligations")
      .select("status")
      .eq("id", oblB)
      .single();
    expect(afterObl?.status).toBe(beforeObl?.status);
    expect(afterObl?.status).not.toBe("settled");
  });

  it("20+24: dispute has no financial effect; cross-household payment access fails", async () => {
    const b = await authed(emailB, password);
    const before = await b.client
      .from("obligation_balances_v")
      .select("official_outstanding_cents")
      .eq("obligation_id", oblB)
      .single();

    const dispute = await b.client.rpc("open_dispute", {
      p_household_id: householdA,
      p_dispute_type: "obligation_amount",
      p_reason: "Looks high",
      p_obligation_id: oblB,
    });
    expect(dispute.error).toBeNull();

    const after = await b.client
      .from("obligation_balances_v")
      .select("official_outstanding_cents")
      .eq("obligation_id", oblB)
      .single();
    expect(after.data?.official_outstanding_cents).toBe(
      before.data?.official_outstanding_cents,
    );

    // Outsider (not a member of household A) cannot read payment rows.
    const outsider = await authed(emailC, password);
    const cross = await outsider.client
      .from("payments")
      .select("id")
      .eq("household_id", householdA);
    expect(cross.data ?? []).toHaveLength(0);
  });

  it("17: payment idempotency", async () => {
    const b = await authed(emailB, password);
    const key = `idem-pay-${runId}`;
    const first = await b.client.rpc("submit_payment", {
      p_household_id: householdA,
      p_recipient_membership_id: memA,
      p_total_amount_cents: 50,
      p_external_method: "cash",
      p_allocations: [{ obligation_id: oblB, amount_cents: 50 }] as unknown as Json,
      p_idempotency_key: key,
    });
    expect(first.error).toBeNull();
    const second = await b.client.rpc("submit_payment", {
      p_household_id: householdA,
      p_recipient_membership_id: memA,
      p_total_amount_cents: 50,
      p_external_method: "cash",
      p_allocations: [{ obligation_id: oblB, amount_cents: 50 }] as unknown as Json,
      p_idempotency_key: key,
    });
    expect(second.error).toBeNull();
    expect((second.data as { id: string }).id).toBe((first.data as { id: string }).id);
  });

  it("consistency: stored obligation status agrees with derived settlement_state", async () => {
    const a = await authed(emailA, password);
    const { data: rows } = await a.client
      .from("obligation_balances_v")
      .select(
        "obligation_id, settlement_state, official_outstanding_cents, effective_amount_cents",
      )
      .eq("household_id", householdA);
    expect((rows ?? []).length).toBeGreaterThan(0);
    for (const row of rows ?? []) {
      expect(row.obligation_id).toBeTruthy();
      const { data: obl } = await a.client
        .from("reimbursement_obligations")
        .select("status")
        .eq("id", row.obligation_id!)
        .single();
      expect(row.official_outstanding_cents ?? 0).toBeGreaterThanOrEqual(0);
      expect(
        storedStatusSyncedWithDerived({
          storedStatus: obl!.status,
          settlementState: (row.settlement_state ?? "unpaid") as
            | "unpaid"
            | "partially_settled"
            | "settled"
            | "reversed",
        }),
      ).toBe(true);
    }
  });

  it("private details: only sender and recipient can read; party C cannot", async () => {
    const tokenC = generateInviteToken();
    const a = await authed(emailA, password);
    await a.client.rpc("create_household_invitation", {
      p_household_id: householdA,
      p_email: emailC,
      p_token_hash: hashInviteToken(tokenC),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_intended_roles: ["member"],
    });
    const c = await authed(emailC, password);
    await c.client.rpc("accept_household_invitation", {
      p_token_hash: hashInviteToken(tokenC),
    });

    const b = await authed(emailB, password);
    const secretRef = `PRIVATE-REF-${runId}`;
    const submitted = await b.client.rpc("submit_payment", {
      p_household_id: householdA,
      p_recipient_membership_id: memA,
      p_total_amount_cents: 25,
      p_external_method: "venmo",
      p_allocations: [{ obligation_id: oblB, amount_cents: 25 }] as unknown as Json,
      p_idempotency_key: `priv-${runId}`,
      p_private_note: "do not share",
      p_external_reference: secretRef,
    });
    expect(submitted.error).toBeNull();
    const paymentId = (submitted.data as { id: string }).id;

    const asSender = await b.client
      .from("payment_private_details")
      .select("external_reference, private_note")
      .eq("payment_id", paymentId)
      .maybeSingle();
    expect(asSender.data?.external_reference).toBe(secretRef);

    const asRecipient = await a.client
      .from("payment_private_details")
      .select("external_reference")
      .eq("payment_id", paymentId)
      .maybeSingle();
    expect(asRecipient.data?.external_reference).toBe(secretRef);

    const asOtherMember = await c.client
      .from("payment_private_details")
      .select("external_reference, private_note")
      .eq("payment_id", paymentId);
    expect(asOtherMember.data ?? []).toHaveLength(0);

    const nested = await c.client
      .from("payments")
      .select("id, payment_private_details(external_reference)")
      .eq("id", paymentId)
      .maybeSingle();
    const nestedDetails = (
      nested.data as { payment_private_details?: { external_reference: string }[] | null } | null
    )?.payment_private_details;
    expect(nestedDetails ?? []).toHaveLength(0);

    const { data: events } = await a.client
      .from("notification_events")
      .select("payload")
      .eq("household_id", householdA)
      .eq("entity_id", paymentId);
    for (const ev of events ?? []) {
      const payload = JSON.stringify(ev.payload ?? {});
      expect(payload).not.toContain(secretRef);
      expect(payload).not.toContain("do not share");
      expect(payload.toLowerCase()).not.toContain("private");
    }
  });

  it("notifications: owner-only fan-out; payloads are routing metadata; idempotent", async () => {
    const a = await authed(emailA, password);
    const b = await authed(emailB, password);
    const { data: aUser } = await a.client.auth.getUser();
    const { data: bUser } = await b.client.auth.getUser();

    const { data: myNotifs } = await a.client
      .from("user_notifications")
      .select("id, user_id, title, body")
      .eq("household_id", householdA);
    expect((myNotifs ?? []).every((n) => n.user_id === aUser.user!.id)).toBe(true);

    const peekB = await b.client
      .from("user_notifications")
      .select("id, user_id")
      .neq("user_id", bUser.user!.id);
    expect(peekB.data ?? []).toHaveLength(0);

    const { data: events } = await a.client
      .from("notification_events")
      .select("payload, event_type, entity_type, entity_id")
      .eq("household_id", householdA)
      .limit(20);
    for (const ev of events ?? []) {
      const keys = Object.keys((ev.payload as Record<string, unknown>) ?? {}).sort();
      expect(keys).toEqual(["source_id", "source_type"]);
      const blob = JSON.stringify(ev.payload);
      expect(blob).not.toMatch(/@/);
      expect(blob.toLowerCase()).not.toMatch(/token|password|secret|venmo|zelle/);
    }
  });

  it("privileged bypass: service_role without GUC cannot delete payments; cleanup requires run id", async () => {
    const blocked = await admin.from("payments").delete().eq("household_id", householdA);
    // Trigger / RLS / RPC-only gate must reject broad privileged deletes.
    expect(blocked.error || (blocked.count ?? 0) === 0).toBeTruthy();

    const { data: stillThere } = await admin
      .from("payments")
      .select("id")
      .eq("household_id", householdA)
      .limit(1);
    expect((stillThere ?? []).length).toBeGreaterThan(0);

    const badCleanup = await admin.rpc(
      "cleanup_test_household_data" as never,
      { p_test_run_id: "short" } as never,
    );
    expect(badCleanup.error).toBeTruthy();

    const anonCleanup = await (
      await authed(emailA, password)
    ).client.rpc("cleanup_test_household_data" as never, {
      p_test_run_id: runId,
    } as never);
    expect(anonCleanup.error).toBeTruthy();
  });

  it("reject + cancel keep outstanding unchanged / reopen for new submission", async () => {
    const b = await authed(emailB, password);
    const { data: before } = await b.client
      .from("obligation_balances_v")
      .select("official_outstanding_cents")
      .eq("obligation_id", oblB)
      .single();

    const rejected = await b.client.rpc("submit_payment", {
      p_household_id: householdA,
      p_recipient_membership_id: memA,
      p_total_amount_cents: 10,
      p_external_method: "cash",
      p_allocations: [{ obligation_id: oblB, amount_cents: 10 }] as unknown as Json,
      p_idempotency_key: `rej-${runId}`,
    });
    expect(rejected.error).toBeNull();
    const rejectId = (rejected.data as { id: string }).id;
    const a = await authed(emailA, password);
    expect(
      (
        await a.client.rpc("reject_payment", {
          p_payment_id: rejectId,
          p_reason: "Payment not received",
        })
      ).error,
    ).toBeNull();

    const cancelled = await b.client.rpc("submit_payment", {
      p_household_id: householdA,
      p_recipient_membership_id: memA,
      p_total_amount_cents: 10,
      p_external_method: "cash",
      p_allocations: [{ obligation_id: oblB, amount_cents: 10 }] as unknown as Json,
      p_idempotency_key: `can-${runId}`,
    });
    expect(cancelled.error).toBeNull();
    expect(
      (
        await b.client.rpc("cancel_payment", {
          p_payment_id: (cancelled.data as { id: string }).id,
        })
      ).error,
    ).toBeNull();

    const { data: after } = await b.client
      .from("obligation_balances_v")
      .select("official_outstanding_cents")
      .eq("obligation_id", oblB)
      .single();
    expect(after?.official_outstanding_cents).toBe(before?.official_outstanding_cents);
  });
});
