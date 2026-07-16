/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateInviteToken, hashInviteToken } from "@/lib/tokens";
import type { Database } from "@/types/database";
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
const runId = `house-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = "Test-Password-123!";

type Admin = SupabaseClient<Database>;
type Session = {
  email: string;
  userId: string;
  client: SupabaseClient<Database>;
};

type RpcResult<T = unknown> = { data: T; error: { message: string } | null };

function crpc<T = unknown>(
  client: SupabaseClient<Database>,
  fn: string,
  args: Record<string, unknown>,
): Promise<RpcResult<T>> {
  return (client as any).rpc(fn, args) as Promise<RpcResult<T>>;
}

function ctable(client: SupabaseClient<Database>, name: string): any {
  return (client as any).from(name);
}

async function authed(email: string): Promise<Session> {
  const session = await getAuthedClient(email, password);
  return { email, client: session.client, userId: session.userId };
}

describe.skipIf(!hasSupabase)("Phase 6 house resources RLS + RPCs", () => {
  let admin: Admin;
  const createdUserIds: string[] = [];

  let householdA: string;
  let memA: string;
  let memB: string;
  let userA: Session;
  let userB: Session;
  let householdD: string;
  let userO: Session;

  const emailA = `ha-${runId}@${TEST_DOMAIN}`;
  const emailB = `hb-${runId}@${TEST_DOMAIN}`;
  const emailO = `ho-${runId}@${TEST_DOMAIN}`;

  async function membershipId(householdId: string, userId: string) {
    const { data } = await admin
      .from("household_memberships")
      .select("id")
      .eq("household_id", householdId)
      .eq("user_id", userId)
      .single();
    return data!.id as string;
  }

  async function inviteAccept(
    inviter: Session,
    inviteeEmail: string,
    householdId: string,
  ): Promise<Session> {
    const token = generateInviteToken();
    const invite = await inviter.client.rpc("create_household_invitation", {
      p_household_id: householdId,
      p_email: inviteeEmail,
      p_token_hash: hashInviteToken(token),
      p_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_intended_roles: ["member"],
    });
    expect(invite.error).toBeNull();
    const invitee = await authed(inviteeEmail);
    const accept = await invitee.client.rpc("accept_household_invitation", {
      p_token_hash: hashInviteToken(token),
    });
    expect(accept.error).toBeNull();
    return invitee;
  }

  beforeAll(async () => {
    admin = createClient<Database>(url!, secretKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await admin.from("auth_registration_policy").upsert({
      id: 1,
      mode: "invite_only",
      allow_test_emails: true,
      test_email_domain: TEST_DOMAIN,
    });

    for (const email of [emailA, emailB, emailO]) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(created.error).toBeNull();
      createdUserIds.push(created.data.user!.id);
    }

    userA = await authed(emailA);

    const createdHh = await userA.client.rpc("create_household_for_current_user", {
      p_name: `HouseA-${runId}`,
      p_acknowledge_reimbursement_policy: true,
      p_idempotency_key: `${runId}-hhA`,
    });
    expect(createdHh.error).toBeNull();
    const rowA = Array.isArray(createdHh.data) ? createdHh.data[0] : createdHh.data;
    householdA = rowA!.household_id;
    memA = rowA!.membership_id;

    userB = await inviteAccept(userA, emailB, householdA);
    memB = await membershipId(householdA, userB.userId);

    userO = await authed(emailO);
    const createdD = await userO.client.rpc("create_household_for_current_user", {
      p_name: `HouseD-${runId}`,
      p_acknowledge_reimbursement_policy: true,
      p_idempotency_key: `${runId}-hhD`,
    });
    expect(createdD.error).toBeNull();
    const rowD = Array.isArray(createdD.data) ? createdD.data[0] : createdD.data;
    householdD = rowD!.household_id;
  }, 90_000);

  afterAll(async () => {
    if (!admin) return;
    await cleanupTestHouseholdsByRunId(admin, runId);
    await deleteTestAuthUsers(admin, createdUserIds);
  }, 90_000);

  it("[1] active member creates household inventory", async () => {
    const { data, error } = await crpc<string>(userA.client, "create_inventory_item", {
      p_household_id: householdA,
      p_name: "Vacuum",
      p_category: "appliance",
      p_ownership_mode: "household",
    });
    expect(error).toBeNull();
    expect(data).toBeTruthy();
  });

  it("[2] cross-household inventory creation denied", async () => {
    const { error } = await crpc(userO.client, "create_inventory_item", {
      p_household_id: householdA,
      p_name: "Stolen vacuum",
      p_category: "appliance",
    });
    expect(error).toBeTruthy();
  });

  it("[3] personal pantry hidden from other members", async () => {
    const { data: pantryId, error } = await crpc<string>(userA.client, "create_pantry_item", {
      p_household_id: householdA,
      p_name: "Personal yogurt",
      p_category: "dairy",
      p_ownership_mode: "personal",
      p_owner_membership_id: memA,
    });
    expect(error).toBeNull();
    const { data: visibleToB } = await ctable(userB.client, "pantry_items")
      .select("id")
      .eq("id", pantryId)
      .maybeSingle();
    expect(visibleToB).toBeNull();
  });

  it("[4] another member cannot transfer personal ownership", async () => {
    const { data: itemId } = await crpc<string>(userA.client, "create_inventory_item", {
      p_household_id: householdA,
      p_name: "Personal lamp",
      p_category: "decor",
      p_ownership_mode: "personal",
      p_owner_membership_id: memA,
    });
    const { error } = await crpc(userB.client, "change_inventory_ownership", {
      p_item_id: itemId,
      p_ownership_mode: "personal",
      p_owner_membership_id: memB,
    });
    expect(error).toBeTruthy();
  });

  it("[5] condition history via RPC; direct update blocked", async () => {
    const { data: itemId } = await crpc<string>(userA.client, "create_inventory_item", {
      p_household_id: householdA,
      p_name: "Chair",
      p_category: "furniture",
      p_condition: "good",
    });
    const { error } = await crpc(userA.client, "change_inventory_condition", {
      p_item_id: itemId,
      p_new_condition: "damaged",
      p_reason: "Leg cracked",
    });
    expect(error).toBeNull();
    const direct = await ctable(userA.client, "inventory_items")
      .update({ condition: "new" })
      .eq("id", itemId);
    expect(direct.error).toBeTruthy();
  });

  it("[6] supply low → shopping dedupe → claim → purchase updates stock", async () => {
    const { data: supplyId, error: sErr } = await crpc<string>(userA.client, "create_supply_item", {
      p_household_id: householdA,
      p_name: "Toilet paper",
      p_category: "paper_goods",
      p_stock_state: "in_stock",
      p_quantity: 6,
      p_quantity_unit: "roll",
      p_responsible_membership_id: memA,
    });
    expect(sErr).toBeNull();
    expect((await crpc(userA.client, "mark_supply_low", { p_item_id: supplyId })).error).toBeNull();

    const { data: shopId, error: shopErr } = await crpc<string>(
      userA.client,
      "create_shopping_item",
      {
        p_household_id: householdA,
        p_name: "Toilet paper",
        p_category: "supplies",
        p_related_supply_id: supplyId,
      },
    );
    expect(shopErr).toBeNull();
    expect(
      (
        await crpc(userB.client, "create_shopping_item", {
          p_household_id: householdA,
          p_name: "Toilet paper again",
          p_related_supply_id: supplyId,
        })
      ).error,
    ).toBeTruthy();

    expect(
      (await crpc(userB.client, "claim_shopping_item", { p_item_id: shopId })).error,
    ).toBeNull();
    expect(
      (
        await crpc(userB.client, "mark_shopping_item_purchased", {
          p_item_id: shopId,
          p_purchased_quantity: 12,
          p_update_related_stock: true,
        })
      ).error,
    ).toBeNull();
    expect(
      (await crpc(userB.client, "mark_shopping_item_purchased", { p_item_id: shopId })).error,
    ).toBeNull();

    const { data: supply } = await ctable(userA.client, "supply_items")
      .select("stock_state")
      .eq("id", supplyId)
      .single();
    expect(supply?.stock_state).toBe("in_stock");
  });

  it("[7] cross-household expense link rejected", async () => {
    const { data: invId } = await crpc<string>(userA.client, "create_inventory_item", {
      p_household_id: householdA,
      p_name: "Toaster",
      p_category: "appliance",
    });
    const { error } = await crpc(userA.client, "link_resource_to_expense_item", {
      p_household_id: householdA,
      p_expense_item_id: "00000000-0000-4000-8000-000000000099",
      p_resource_type: "inventory",
      p_resource_id: invId,
      p_link_kind: "acquisition",
    });
    expect(error).toBeTruthy();
  });

  it("[8] authenticated cannot call privileged cleanup", async () => {
    const { error } = await crpc(userA.client, "cleanup_test_household_data", {
      p_test_run_id: runId,
    });
    expect(error).toBeTruthy();
  });

  it("[9] outsider household id unused guard", () => {
    expect(householdD).toBeTruthy();
  });

  it("[10] same-household expense link succeeds", async () => {
    const { data: itemId, error: itemErr } = await crpc<string>(
      userA.client,
      "create_inventory_item",
      {
        p_household_id: householdA,
        p_name: "Blender",
        p_category: "kitchenware",
      },
    );
    expect(itemErr).toBeNull();

    const { data: draft, error: draftErr } = await ctable(userA.client, "expenses")
      .insert({
        household_id: householdA,
        created_by_membership_id: memA,
        payer_membership_id: memA,
        merchant: "Kitchen Mart",
        purchase_date: "2026-07-01",
        currency: "USD",
        declared_total_cents: 4000,
        status: "draft",
      })
      .select()
      .single();
    expect(draftErr).toBeNull();

    const { data: expenseItem, error: expenseItemErr } = await ctable(
      userA.client,
      "expense_items",
    )
      .insert({
        expense_id: draft.id,
        household_id: householdA,
        description: "Blender",
        total_cents: 4000,
        allocation_mode: "equal_all",
      })
      .select()
      .single();
    expect(expenseItemErr).toBeNull();

    const { data: linkId, error: linkErr } = await crpc<string>(
      userA.client,
      "link_resource_to_expense_item",
      {
        p_household_id: householdA,
        p_expense_item_id: expenseItem.id,
        p_resource_type: "inventory",
        p_resource_id: itemId,
        p_link_kind: "acquisition",
      },
    );
    expect(linkErr).toBeNull();
    expect(linkId).toBeTruthy();

    const { data: link } = await admin
      .from("resource_expense_links" as never)
      .select("resource_id, resource_type, unlinked_at")
      .eq("id", linkId as string)
      .single();
    expect((link as any)?.resource_id).toBe(itemId);
    expect((link as any)?.unlinked_at).toBeNull();
  });

  it("[11] direct table insert blocked by rpc-only trigger", async () => {
    const { data: forged, error } = await ctable(userA.client, "inventory_items").insert({
      household_id: householdA,
      name: "Forged item",
      category: "other",
      created_by_membership_id: memA,
    });
    expect(forged).toBeNull();
    expect(error).toBeTruthy();
    expect(String(error?.message ?? "").toLowerCase()).toMatch(
      /secure functions|rpc|permission denied/,
    );
  });
});
