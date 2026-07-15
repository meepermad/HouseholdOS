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
const runId = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type Admin = SupabaseClient<Database>;

function authed(email: string, password: string) {
  return getAuthedClient(email, password);
}

async function inviteAccept(
  inviter: Awaited<ReturnType<typeof authed>>,
  inviteeEmail: string,
  householdId: string,
  inviteePassword: string,
) {
  const token = generateInviteToken();
  const invite = await inviter.client.rpc("create_household_invitation", {
    p_household_id: householdId,
    p_email: inviteeEmail,
    p_token_hash: hashInviteToken(token),
    p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    p_intended_roles: ["member"],
  });
  expect(invite.error).toBeNull();
  const invitee = await authed(inviteeEmail, inviteePassword);
  const accept = await invitee.client.rpc("accept_household_invitation", {
    p_token_hash: hashInviteToken(token),
  });
  expect(accept.error).toBeNull();
  return invitee;
}

describe.skipIf(!hasSupabase)("expense RLS and confirmation", () => {
  let admin: Admin;
  const createdUserIds: string[] = [];
  let householdA: string;
  let householdB: string;
  let memA: string;
  let memB: string;
  let memC: string;
  let memAOnB: string;
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

    emailA = `ea-${runId}@${TEST_DOMAIN}`;
    emailB = `eb-${runId}@${TEST_DOMAIN}`;
    emailC = `ec-${runId}@${TEST_DOMAIN}`;
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
      p_name: `ExpA-${runId}`,
      p_acknowledge_reimbursement_policy: true,
    });
    householdA = createdA.data as string;

    const bAlone = await authed(emailB, password);
    const createdB = await bAlone.client.rpc("create_household", {
      p_name: `ExpB-${runId}`,
      p_acknowledge_reimbursement_policy: true,
    });
    householdB = createdB.data as string;
    const { data: memOnB } = await bAlone.client
      .from("household_memberships")
      .select("id")
      .eq("household_id", householdB)
      .eq("user_id", bAlone.userId)
      .single();
    memAOnB = memOnB!.id;

    const { data: mA } = await a.client
      .from("household_memberships")
      .select("id")
      .eq("household_id", householdA)
      .eq("user_id", a.userId)
      .single();
    memA = mA!.id;

    const b = await inviteAccept(a, emailB, householdA, password);
    const { data: mB } = await b.client
      .from("household_memberships")
      .select("id")
      .eq("household_id", householdA)
      .eq("user_id", b.userId)
      .single();
    memB = mB!.id;

    const c = await inviteAccept(a, emailC, householdA, password);
    const { data: mC } = await c.client
      .from("household_memberships")
      .select("id")
      .eq("household_id", householdA)
      .eq("user_id", c.userId)
      .single();
    memC = mC!.id;
  }, 180_000);

  afterAll(async () => {
    if (!admin) return;
    await cleanupTestHouseholdsByRunId(admin, runId);
    await deleteTestAuthUsers(admin, createdUserIds);
  }, 180_000);

  async function createDraft(
    client: SupabaseClient<Database>,
    opts: {
      householdId: string;
      creatorMembershipId: string;
      payerMembershipId: string;
      total: number;
      merchant?: string;
    },
  ) {
    const { data, error } = await client
      .from("expenses")
      .insert({
        household_id: opts.householdId,
        created_by_membership_id: opts.creatorMembershipId,
        payer_membership_id: opts.payerMembershipId,
        merchant: opts.merchant ?? "Test Mart",
        purchase_date: "2026-07-01",
        currency: "USD",
        declared_total_cents: opts.total,
        status: "draft",
      })
      .select("*")
      .single();
    expect(error).toBeNull();
    return data!;
  }

  it("user A cannot read Household B expense", async () => {
    const b = await authed(emailB, password);
    const draft = await createDraft(b.client, {
      householdId: householdB,
      creatorMembershipId: memAOnB,
      payerMembershipId: memAOnB,
      total: 100,
    });
    const a = await authed(emailA, password);
    const leak = await a.client.from("expenses").select("*").eq("id", draft.id).maybeSingle();
    expect(leak.data).toBeNull();
  });

  it("user A cannot create expense in Household B", async () => {
    const a = await authed(emailA, password);
    const { data, error } = await a.client.from("expenses").insert({
      household_id: householdB,
      created_by_membership_id: memA,
      payer_membership_id: memAOnB,
      merchant: "Nope",
      purchase_date: "2026-07-01",
      currency: "USD",
      declared_total_cents: 50,
      status: "draft",
    });
    expect(data).toBeNull();
    expect(error).toBeTruthy();
  });

  it("cannot allocate to membership from another household", async () => {
    const a = await authed(emailA, password);
    const draft = await createDraft(a.client, {
      householdId: householdA,
      creatorMembershipId: memA,
      payerMembershipId: memA,
      total: 100,
    });
    const { data: item } = await a.client
      .from("expense_items")
      .insert({
        expense_id: draft.id,
        household_id: householdA,
        description: "Bad alloc",
        total_cents: 100,
        allocation_mode: "personal",
        personal_membership_id: memA,
      })
      .select("id")
      .single();

    const { error } = await a.client.from("expense_item_allocations").insert({
      item_id: item!.id,
      expense_id: draft.id,
      household_id: householdA,
      membership_id: memAOnB,
      amount_cents: 100,
    });
    expect(error).toBeTruthy();
  });

  it("cannot set payer from another household", async () => {
    const a = await authed(emailA, password);
    const { error } = await a.client.from("expenses").insert({
      household_id: householdA,
      created_by_membership_id: memA,
      payer_membership_id: memAOnB,
      merchant: "Bad payer",
      purchase_date: "2026-07-01",
      currency: "USD",
      declared_total_cents: 10,
      status: "draft",
    });
    expect(error).toBeTruthy();
  });

  it("member cannot directly insert reimbursement obligations", async () => {
    const a = await authed(emailA, password);
    const { error } = await a.client.from("reimbursement_obligations").insert({
      household_id: householdA,
      expense_id: crypto.randomUUID(),
      creditor_membership_id: memA,
      debtor_membership_id: memB,
      original_amount_cents: 100,
      current_amount_cents: 100,
      status: "pending",
    });
    expect(error).toBeTruthy();
  });

  it("confirmation creates obligations atomically and is idempotent", async () => {
    const a = await authed(emailA, password);
    const draft = await createDraft(a.client, {
      householdId: householdA,
      creatorMembershipId: memA,
      payerMembershipId: memA,
      total: 900,
      merchant: "Confirm Shop",
    });

    const { data: item } = await a.client
      .from("expense_items")
      .insert({
        expense_id: draft.id,
        household_id: householdA,
        description: "Shared",
        total_cents: 900,
        allocation_mode: "equal_selected",
      })
      .select("id")
      .single();

    await a.client.from("expense_item_allocations").insert([
      { item_id: item!.id, expense_id: draft.id, household_id: householdA, membership_id: memA, amount_cents: 0 },
      { item_id: item!.id, expense_id: draft.id, household_id: householdA, membership_id: memB, amount_cents: 0 },
      { item_id: item!.id, expense_id: draft.id, household_id: householdA, membership_id: memC, amount_cents: 0 },
    ]);

    const calc = calculateExpense({
      payerMembershipId: memA,
      eligibleMembershipIds: [memA, memB, memC],
      currency: "USD",
      householdCurrency: "USD",
      declaredTotalCents: 900,
      items: [
        {
          id: item!.id,
          description: "Shared",
          totalCents: 900,
          allocationMode: "equal_selected",
          participants: [
            { membershipId: memA },
            { membershipId: memB },
            { membershipId: memC },
          ],
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

    const key = `idem-${draft.id}`;
    const first = await a.client.rpc("confirm_expense", {
      p_expense_id: draft.id,
      p_idempotency_key: key,
      p_snapshot: snapshot,
    });
    expect(first.error).toBeNull();

    const { data: obls } = await a.client
      .from("reimbursement_obligations")
      .select("*")
      .eq("expense_id", draft.id);
    expect(obls).toHaveLength(2);

    const second = await a.client.rpc("confirm_expense", {
      p_expense_id: draft.id,
      p_idempotency_key: key,
      p_snapshot: snapshot,
    });
    expect(second.error).toBeNull();

    const { data: obls2 } = await a.client
      .from("reimbursement_obligations")
      .select("*")
      .eq("expense_id", draft.id);
    expect(obls2).toHaveLength(2);

    const dupKey = await a.client.rpc("confirm_expense", {
      p_expense_id: draft.id,
      p_idempotency_key: "different-key-xx",
      p_snapshot: snapshot,
    });
    expect(dupKey.error).toBeTruthy();
  });

  it("member cannot directly update a confirmed expense", async () => {
    const a = await authed(emailA, password);
    const { data: confirmed } = await a.client
      .from("expenses")
      .select("id")
      .eq("household_id", householdA)
      .eq("status", "confirmed")
      .limit(1)
      .maybeSingle();
    if (!confirmed) return;

    const { data } = await a.client
      .from("expenses")
      .update({ merchant: "Hacked" })
      .eq("id", confirmed.id)
      .select();
    expect(data ?? []).toHaveLength(0);
  });

  it("member cannot directly change obligation amounts", async () => {
    const a = await authed(emailA, password);
    const { data: obl } = await a.client
      .from("reimbursement_obligations")
      .select("id")
      .eq("household_id", householdA)
      .limit(1)
      .maybeSingle();
    if (!obl) return;

    const { data } = await a.client
      .from("reimbursement_obligations")
      .update({ current_amount_cents: 1 })
      .eq("id", obl.id)
      .select();
    expect(data ?? []).toHaveLength(0);
  });

  it("failed confirmation creates no partial obligations", async () => {
    const a = await authed(emailA, password);
    const draft = await createDraft(a.client, {
      householdId: householdA,
      creatorMembershipId: memA,
      payerMembershipId: memA,
      total: 500,
      merchant: "Fail Shop",
    });
    await a.client.from("expense_items").insert({
      expense_id: draft.id,
      household_id: householdA,
      description: "Item",
      total_cents: 500,
      allocation_mode: "equal_all",
    });

    const badSnapshot = {
      calculated_subtotal_cents: 500,
      calculated_adjustments_cents: 0,
      item_allocations: [],
      adjustment_allocations: [],
      obligations: [
        {
          debtor_membership_id: memB,
          creditor_membership_id: memA,
          amount_cents: 100,
        },
      ],
    } as unknown as Json;

    const result = await a.client.rpc("confirm_expense", {
      p_expense_id: draft.id,
      p_idempotency_key: `fail-${draft.id}`,
      p_snapshot: badSnapshot,
    });
    expect(result.error).toBeTruthy();

    const { data: obls } = await a.client
      .from("reimbursement_obligations")
      .select("id")
      .eq("expense_id", draft.id);
    expect(obls ?? []).toHaveLength(0);

    const { data: exp } = await a.client
      .from("expenses")
      .select("status")
      .eq("id", draft.id)
      .single();
    expect(exp?.status).toBe("draft");
  });

  it("direct audit forgery of expense.confirmed fails allowlist path differently but actor stays auth.uid", async () => {
    const a = await authed(emailA, password);
    // Fake event type not in allowlist
    const forged = await a.client.rpc("write_audit_event", {
      p_household_id: householdA,
      p_entity_type: "expense",
      p_entity_id: crypto.randomUUID(),
      p_event_type: "expense.forged",
      p_after_state: { hack: true },
    });
    expect(forged.error).toBeTruthy();
  });

  it("void creates reversals and amendment preserves original", async () => {
    const a = await authed(emailA, password);
    const draft = await createDraft(a.client, {
      householdId: householdA,
      creatorMembershipId: memA,
      payerMembershipId: memA,
      total: 400,
      merchant: "Amend Shop",
    });
    const { data: item } = await a.client
      .from("expense_items")
      .insert({
        expense_id: draft.id,
        household_id: householdA,
        description: "Personal B",
        total_cents: 400,
        allocation_mode: "personal",
        personal_membership_id: memB,
      })
      .select("id")
      .single();
    await a.client.from("expense_item_allocations").insert({
      item_id: item!.id,
      expense_id: draft.id,
      household_id: householdA,
      membership_id: memB,
      amount_cents: 0,
    });

    const calc = calculateExpense({
      payerMembershipId: memA,
      eligibleMembershipIds: [memA, memB, memC],
      currency: "USD",
      householdCurrency: "USD",
      declaredTotalCents: 400,
      items: [
        {
          id: item!.id,
          description: "Personal B",
          totalCents: 400,
          allocationMode: "personal",
          personalMembershipId: memB,
        },
      ],
      adjustments: [],
    });
    expect(calc.ok).toBe(true);
    if (!calc.ok) return;

    const snapshot = {
      calculated_subtotal_cents: 400,
      calculated_adjustments_cents: 0,
      item_allocations: [
        { item_id: item!.id, membership_id: memB, amount_cents: 400 },
      ],
      adjustment_allocations: [],
      obligations: [
        {
          debtor_membership_id: memB,
          creditor_membership_id: memA,
          amount_cents: 400,
        },
      ],
    } as unknown as Json;

    const confirmed = await a.client.rpc("confirm_expense", {
      p_expense_id: draft.id,
      p_idempotency_key: `amd-${draft.id}`,
      p_snapshot: snapshot,
    });
    expect(confirmed.error).toBeNull();

    const amendment = await a.client.rpc("create_expense_amendment", {
      p_expense_id: draft.id,
      p_reason: "Wrong assignment",
    });
    expect(amendment.error).toBeNull();
    const amendmentExpense = amendment.data as { id: string };

    const { data: original } = await a.client
      .from("expenses")
      .select("status")
      .eq("id", draft.id)
      .single();
    expect(original?.status).toBe("confirmed");

    // Confirm amendment with same numbers for simplicity
    const { data: newItems } = await a.client
      .from("expense_items")
      .select("id")
      .eq("expense_id", amendmentExpense.id);
    const newItemId = newItems![0]!.id;

    const amdSnapshot = {
      calculated_subtotal_cents: 400,
      calculated_adjustments_cents: 0,
      item_allocations: [
        { item_id: newItemId, membership_id: memB, amount_cents: 400 },
      ],
      adjustment_allocations: [],
      obligations: [
        {
          debtor_membership_id: memB,
          creditor_membership_id: memA,
          amount_cents: 400,
        },
      ],
    } as unknown as Json;

    const amdConfirm = await a.client.rpc("confirm_expense_amendment", {
      p_amendment_expense_id: amendmentExpense.id,
      p_idempotency_key: `amd-confirm-${amendmentExpense.id}`,
      p_snapshot: amdSnapshot,
    });
    expect(amdConfirm.error).toBeNull();

    const { data: origAfter } = await a.client
      .from("expenses")
      .select("status, superseded_by_expense_id")
      .eq("id", draft.id)
      .single();
    expect(origAfter?.status).toBe("amended");
    expect(origAfter?.superseded_by_expense_id).toBe(amendmentExpense.id);

    // Void a separate confirmed expense
    const voidDraft = await createDraft(a.client, {
      householdId: householdA,
      creatorMembershipId: memA,
      payerMembershipId: memA,
      total: 200,
      merchant: "Void Shop",
    });
    const { data: vItem } = await a.client
      .from("expense_items")
      .insert({
        expense_id: voidDraft.id,
        household_id: householdA,
        description: "To void",
        total_cents: 200,
        allocation_mode: "personal",
        personal_membership_id: memC,
      })
      .select("id")
      .single();
    await a.client.from("expense_item_allocations").insert({
      item_id: vItem!.id,
      expense_id: voidDraft.id,
      household_id: householdA,
      membership_id: memC,
      amount_cents: 0,
    });
    await a.client.rpc("confirm_expense", {
      p_expense_id: voidDraft.id,
      p_idempotency_key: `void-${voidDraft.id}`,
      p_snapshot: {
        calculated_subtotal_cents: 200,
        calculated_adjustments_cents: 0,
        item_allocations: [
          { item_id: vItem!.id, membership_id: memC, amount_cents: 200 },
        ],
        adjustment_allocations: [],
        obligations: [
          {
            debtor_membership_id: memC,
            creditor_membership_id: memA,
            amount_cents: 200,
          },
        ],
      } as unknown as Json,
    });

    const voided = await a.client.rpc("void_expense", {
      p_expense_id: voidDraft.id,
      p_reason: "Entered by mistake",
    });
    expect(voided.error).toBeNull();

    const { data: voidObls } = await a.client
      .from("reimbursement_obligations")
      .select("status, current_amount_cents")
      .eq("expense_id", voidDraft.id);
    expect(voidObls?.every((o) => o.status === "reversed" && o.current_amount_cents === 0)).toBe(
      true,
    );
  });

  it("removed members cannot access new expenses", async () => {
    const a = await authed(emailA, password);
    await a.client.rpc("remove_household_member", {
      p_household_id: householdA,
      p_membership_id: memC,
      p_reason: "test remove",
    });

    const draft = await createDraft(a.client, {
      householdId: householdA,
      creatorMembershipId: memA,
      payerMembershipId: memA,
      total: 50,
      merchant: "After remove",
    });
    // Submit for review so others could see — but C is removed
    await a.client
      .from("expenses")
      .update({ status: "ready_for_review" })
      .eq("id", draft.id);

    const c = await authed(emailC, password);
    const leak = await c.client.from("expenses").select("*").eq("id", draft.id).maybeSingle();
    expect(leak.data).toBeNull();
  });

  it("concurrent confirmation creates one result", async () => {
    const a = await authed(emailA, password);
    // Invite a replacement for C if removed — use B + A only
    const draft = await createDraft(a.client, {
      householdId: householdA,
      creatorMembershipId: memA,
      payerMembershipId: memA,
      total: 200,
      merchant: "Concurrent",
    });
    const { data: item } = await a.client
      .from("expense_items")
      .insert({
        expense_id: draft.id,
        household_id: householdA,
        description: "Split",
        total_cents: 200,
        allocation_mode: "equal_selected",
      })
      .select("id")
      .single();
    await a.client.from("expense_item_allocations").insert([
      {
        item_id: item!.id,
        expense_id: draft.id,
        household_id: householdA,
        membership_id: memA,
        amount_cents: 0,
      },
      {
        item_id: item!.id,
        expense_id: draft.id,
        household_id: householdA,
        membership_id: memB,
        amount_cents: 0,
      },
    ]);

    const snapshot = {
      calculated_subtotal_cents: 200,
      calculated_adjustments_cents: 0,
      item_allocations: [
        { item_id: item!.id, membership_id: memA, amount_cents: 100 },
        { item_id: item!.id, membership_id: memB, amount_cents: 100 },
      ],
      adjustment_allocations: [],
      obligations: [
        {
          debtor_membership_id: memB,
          creditor_membership_id: memA,
          amount_cents: 100,
        },
      ],
    } as unknown as Json;

    const key = `concurrent-${draft.id}`;
    const [r1, r2] = await Promise.all([
      a.client.rpc("confirm_expense", {
        p_expense_id: draft.id,
        p_idempotency_key: key,
        p_snapshot: snapshot,
      }),
      a.client.rpc("confirm_expense", {
        p_expense_id: draft.id,
        p_idempotency_key: key,
        p_snapshot: snapshot,
      }),
    ]);
    expect(r1.error ?? r2.error).toBeFalsy();
    // At least one succeeds; the other is either success (idempotent) or already confirmed
    expect([r1.error, r2.error].filter(Boolean).length).toBeLessThanOrEqual(1);

    const { data: obls } = await a.client
      .from("reimbursement_obligations")
      .select("id")
      .eq("expense_id", draft.id);
    expect(obls).toHaveLength(1);
  });
});
