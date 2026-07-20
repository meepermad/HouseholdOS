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
const runId = `route-sec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type Admin = SupabaseClient<Database>;

function authed(email: string, password: string) {
  return getAuthedClient(email, password);
}

async function inviteJoin(
  inviter: Awaited<ReturnType<typeof authed>>,
  householdId: string,
  email: string,
) {
  const token = generateInviteToken();
  await inviter.client.rpc("create_household_invitation", {
    p_household_id: householdId,
    p_email: email,
    p_token_hash: hashInviteToken(token),
    p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    p_intended_roles: ["member"],
  });
  const joiner = await authed(email, "Test-Password-123!");
  await joiner.client.rpc("accept_household_invitation", {
    p_token_hash: hashInviteToken(token),
  });
  const { data: mem } = await joiner.client
    .from("household_memberships")
    .select("id")
    .eq("household_id", householdId)
    .eq("user_id", joiner.userId)
    .single();
  return { joiner, membershipId: mem!.id };
}

async function confirmSplitExpense(args: {
  client: SupabaseClient<Database>;
  householdId: string;
  creatorMem: string;
  payerMem: string;
  participants: string[];
  totalCents: number;
  merchant: string;
}) {
  const { data: draft } = await args.client
    .from("expenses")
    .insert({
      household_id: args.householdId,
      created_by_membership_id: args.creatorMem,
      payer_membership_id: args.payerMem,
      merchant: args.merchant,
      purchase_date: "2026-07-01",
      currency: "USD",
      declared_total_cents: args.totalCents,
      status: "draft",
    })
    .select("*")
    .single();

  const { data: item } = await args.client
    .from("expense_items")
    .insert({
      expense_id: draft!.id,
      household_id: args.householdId,
      description: "Shared",
      total_cents: args.totalCents,
      allocation_mode: "equal_selected",
    })
    .select("id")
    .single();

  await args.client.from("expense_item_allocations").insert(
    args.participants.map((membership_id) => ({
      item_id: item!.id,
      expense_id: draft!.id,
      household_id: args.householdId,
      membership_id,
      amount_cents: 0,
    })),
  );

  const calc = calculateExpense({
    payerMembershipId: args.payerMem,
    eligibleMembershipIds: args.participants,
    currency: "USD",
    householdCurrency: "USD",
    declaredTotalCents: args.totalCents,
    items: [
      {
        id: item!.id,
        description: "Shared",
        totalCents: args.totalCents,
        allocationMode: "equal_selected",
        participants: args.participants.map((membershipId) => ({ membershipId })),
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

  const confirmed = await args.client.rpc("confirm_expense", {
    p_expense_id: draft!.id,
    p_idempotency_key: `route-exp-${args.merchant}-${Date.now()}`,
    p_snapshot: snapshot,
  });
  expect(confirmed.error).toBeNull();
}

describe.skipIf(!hasSupabase)("routed settlement security (A2/A3)", () => {
  let admin: Admin;
  const createdUserIds: string[] = [];
  let householdId: string;
  let memA: string;
  let memB: string;
  let memC: string;
  let emailA: string;
  let emailB: string;
  let emailC: string;
  let emailD: string;
  const password = "Test-Password-123!";
  let oblAb: string;
  let oblBc: string;

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

    emailA = `ra-${runId}@${TEST_DOMAIN}`;
    emailB = `rb-${runId}@${TEST_DOMAIN}`;
    emailC = `rc-${runId}@${TEST_DOMAIN}`;
    emailD = `rd-${runId}@${TEST_DOMAIN}`;
    for (const email of [emailA, emailB, emailC, emailD]) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(created.error).toBeNull();
      createdUserIds.push(created.data.user!.id);
    }

    const a = await authed(emailA, password);
    const created = await a.client.rpc("create_household", {
      p_name: `RouteSec-${runId}`,
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

    const bJoin = await inviteJoin(a, householdId, emailB);
    memB = bJoin.membershipId;
    const cJoin = await inviteJoin(a, householdId, emailC);
    memC = cJoin.membershipId;
    const dJoin = await inviteJoin(a, householdId, emailD);
    expect(dJoin.membershipId).toBeTruthy();

    // A pays? No — for route A→B→C we need A owes B and B owes C:
    // B pays 2000 for B+A → A owes B 1000
    // C pays 2000 for C+B → B owes C 1000
    const b = await authed(emailB, password);
    await confirmSplitExpense({
      client: b.client,
      householdId,
      creatorMem: memB,
      payerMem: memB,
      participants: [memA, memB],
      totalCents: 2000,
      merchant: "AB Mart",
    });
    const c = await authed(emailC, password);
    await confirmSplitExpense({
      client: c.client,
      householdId,
      creatorMem: memC,
      payerMem: memC,
      participants: [memB, memC],
      totalCents: 2000,
      merchant: "BC Mart",
    });

    const { data: obs, error: obsErr } = await admin
      .from("reimbursement_obligations")
      .select("id, debtor_membership_id, creditor_membership_id, current_amount_cents, status")
      .eq("household_id", householdId);
    expect(obsErr).toBeNull();
    const ab = (obs ?? []).find(
      (o) =>
        o.debtor_membership_id === memA && o.creditor_membership_id === memB,
    );
    const bc = (obs ?? []).find(
      (o) =>
        o.debtor_membership_id === memB && o.creditor_membership_id === memC,
    );
    expect(ab, `expected A→B obligation among ${JSON.stringify(obs)}`).toBeTruthy();
    expect(bc, `expected B→C obligation among ${JSON.stringify(obs)}`).toBeTruthy();
    oblAb = ab!.id;
    oblBc = bc!.id;
  }, 120_000);

  afterAll(async () => {
    if (!hasSupabase) return;
    await cleanupTestHouseholdsByRunId(admin, runId);
    await deleteTestAuthUsers(admin, createdUserIds);
  });

  it("rejects intermediary creating a proposal as payer", async () => {
    const b = await authed(emailB, password);
    const res = await b.client.rpc("create_routed_settlement_proposal", {
      p_household_id: householdId,
      p_payer_membership_id: memA,
      p_intermediary_membership_id: memB,
      p_recipient_membership_id: memC,
      p_amount_cents: 500,
      p_obligation_ab_id: oblAb,
      p_obligation_bc_id: oblBc,
      p_idempotency_key: `deny-intermediary-${runId}`,
    });
    expect(res.error).toBeTruthy();
    expect(res.error!.message).toMatch(/Only the payer/i);
  });

  it("rejects recipient and unrelated member creating as payer", async () => {
    const c = await authed(emailC, password);
    const asRecipient = await c.client.rpc("create_routed_settlement_proposal", {
      p_household_id: householdId,
      p_payer_membership_id: memA,
      p_intermediary_membership_id: memB,
      p_recipient_membership_id: memC,
      p_amount_cents: 500,
      p_obligation_ab_id: oblAb,
      p_obligation_bc_id: oblBc,
      p_idempotency_key: `deny-recipient-${runId}`,
    });
    expect(asRecipient.error).toBeTruthy();

    const d = await authed(emailD, password);
    const asUnrelated = await d.client.rpc("create_routed_settlement_proposal", {
      p_household_id: householdId,
      p_payer_membership_id: memA,
      p_intermediary_membership_id: memB,
      p_recipient_membership_id: memC,
      p_amount_cents: 500,
      p_obligation_ab_id: oblAb,
      p_obligation_bc_id: oblBc,
      p_idempotency_key: `deny-unrelated-${runId}`,
    });
    expect(asUnrelated.error).toBeTruthy();
  });

  it("allows payer create; rejects idempotency reuse with changed amount; applies correction with payment reverse", async () => {
    const a = await authed(emailA, password);
    const key = `ok-payer-${runId}`;
    const created = await a.client.rpc("create_routed_settlement_proposal", {
      p_household_id: householdId,
      p_payer_membership_id: memA,
      p_intermediary_membership_id: memB,
      p_recipient_membership_id: memC,
      p_amount_cents: 500,
      p_obligation_ab_id: oblAb,
      p_obligation_bc_id: oblBc,
      p_idempotency_key: key,
    });
    expect(created.error).toBeNull();
    const proposalId = created.data as string;

    const mismatch = await a.client.rpc("create_routed_settlement_proposal", {
      p_household_id: householdId,
      p_payer_membership_id: memA,
      p_intermediary_membership_id: memB,
      p_recipient_membership_id: memC,
      p_amount_cents: 400,
      p_obligation_ab_id: oblAb,
      p_obligation_bc_id: oblBc,
      p_idempotency_key: key,
    });
    expect(mismatch.error).toBeTruthy();
    expect(mismatch.error!.message).toMatch(/mismatched/i);

    const same = await a.client.rpc("create_routed_settlement_proposal", {
      p_household_id: householdId,
      p_payer_membership_id: memA,
      p_intermediary_membership_id: memB,
      p_recipient_membership_id: memC,
      p_amount_cents: 500,
      p_obligation_ab_id: oblAb,
      p_obligation_bc_id: oblBc,
      p_idempotency_key: key,
    });
    expect(same.error).toBeNull();
    expect(same.data).toBe(proposalId);

    const b = await authed(emailB, password);
    expect(
      (
        await b.client.rpc("approve_routed_settlement_intermediary", {
          p_proposal_id: proposalId,
          p_decision: "approved",
        })
      ).error,
    ).toBeNull();

    const c = await authed(emailC, password);
    expect(
      (
        await c.client.rpc("accept_routed_settlement_recipient", {
          p_proposal_id: proposalId,
          p_decision: "accepted",
        })
      ).error,
    ).toBeNull();

    expect(
      (
        await a.client.rpc("submit_routed_settlement_payment", {
          p_proposal_id: proposalId,
          p_external_method: "venmo",
          p_idempotency_key: `pay-${runId}`,
        })
      ).error,
    ).toBeNull();

    expect(
      (await c.client.rpc("confirm_routed_settlement", { p_proposal_id: proposalId }))
        .error,
    ).toBeNull();

    const { data: proposal } = await a.client
      .from("routed_settlement_proposals")
      .select("status, payment_id")
      .eq("id", proposalId)
      .single();
    expect(proposal?.status).toBe("confirmed");
    expect(proposal?.payment_id).toBeTruthy();

    const unilateral = await a.client.rpc("reverse_routed_settlement", {
      p_proposal_id: proposalId,
      p_reason: "should fail",
    });
    expect(unilateral.error).toBeTruthy();
    expect(unilateral.error!.message).toMatch(/disabled|correction/i);

    const req = await a.client.rpc("request_routed_settlement_correction", {
      p_proposal_id: proposalId,
      p_correction_path: "external_payment_returned",
      p_reason: "Venmo returned the transfer",
    });
    expect(req.error).toBeNull();
    const requestId = req.data as string;

    expect(
      (
        await c.client.rpc("respond_routed_settlement_correction", {
          p_request_id: requestId,
          p_decision: "confirmed_return",
        })
      ).error,
    ).toBeNull();

    expect(
      (
        await a.client.rpc("respond_routed_settlement_correction", {
          p_request_id: requestId,
          p_decision: "approved",
        })
      ).error,
    ).toBeNull();

    expect(
      (
        await b.client.rpc("respond_routed_settlement_correction", {
          p_request_id: requestId,
          p_decision: "approved",
        })
      ).error,
    ).toBeNull();

    const { data: after } = await a.client
      .from("routed_settlement_proposals")
      .select("status, payment_id")
      .eq("id", proposalId)
      .single();
    expect(after?.status).toBe("reversed");

    const { data: payment } = await a.client
      .from("payments")
      .select("status")
      .eq("id", after!.payment_id!)
      .single();
    expect(payment?.status).toBe("reversed");

    const { data: reversal } = await a.client
      .from("payment_reversals")
      .select("id")
      .eq("payment_id", after!.payment_id!)
      .maybeSingle();
    expect(reversal?.id).toBeTruthy();

    const double = await a.client.rpc("request_routed_settlement_correction", {
      p_proposal_id: proposalId,
      p_correction_path: "external_payment_returned",
      p_reason: "try again",
    });
    expect(double.error).toBeTruthy();
  }, 120_000);
});
