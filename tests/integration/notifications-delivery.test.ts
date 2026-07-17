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
const runId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const PLANTED_SECRET = `WORKER_SECRET_plant_${runId}_do_not_persist`;

type Admin = SupabaseClient<Database>;
/** Phase 3.1 RPCs/tables may be absent from generated types until migration + gen. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = SupabaseClient<any>;

function authed(email: string, password: string) {
  return getAuthedClient(email, password);
}

function loose(client: SupabaseClient): Loose {
  return client as Loose;
}

function isMissingFeature(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const msg = `${error.message ?? ""} ${error.code ?? ""}`;
  return /could not find the (function|table|view)|schema cache|does not exist|PGRST202|42P01/i.test(
    msg,
  );
}

describe.skipIf(!hasSupabase).sequential("Phase 3.1 notification delivery", () => {
  let admin: Admin;
  const createdUserIds: string[] = [];
  let householdId: string;
  let memA: string;
  let memB: string;
  let oblB: string;
  let emailA: string;
  let emailB: string;
  let userIdA: string;
  let userIdB: string;
  const password = "Test-Password-123!";
  let migrationReady = true;

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

    emailA = `na-${runId}@${TEST_DOMAIN}`;
    emailB = `nb-${runId}@${TEST_DOMAIN}`;
    for (const email of [emailA, emailB]) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(created.error).toBeNull();
      createdUserIds.push(created.data.user!.id);
    }
    userIdA = createdUserIds[0]!;
    userIdB = createdUserIds[1]!;

    // Soft probe: claim RPC from Phase 3.1 migration.
    const probe = await loose(admin).rpc("claim_notification_deliveries", {
      p_batch_size: 1,
    });
    if (isMissingFeature(probe.error)) {
      migrationReady = false;
      console.warn(
        `[notifications-delivery] Phase 3.1 migration not applied (${probe.error?.message}); remaining tests soft-skip.`,
      );
      return;
    }

    const a = await authed(emailA, password);
    const created = await a.client.rpc("create_household", {
      p_name: `NotifA-${runId}`,
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
    const b = await authed(emailB, password);
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
        merchant: "Notif Mart",
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
        expense_id: draft!.id,
        household_id: householdId,
        membership_id: memA,
        amount_cents: 0,
      },
      {
        item_id: item!.id,
        expense_id: draft!.id,
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

    const confirmed = await a.client.rpc("confirm_expense", {
      p_expense_id: draft!.id,
      p_idempotency_key: `notif-exp-${runId}`,
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
    if (householdId) {
      await cleanupTestHouseholdsByRunId(admin, runId);
    }
    // Push subs / quiet hours / prefs are user-scoped — clean by user id via admin.
    for (const uid of createdUserIds) {
      await loose(admin).from("push_subscriptions").delete().eq("user_id", uid);
      await loose(admin)
        .from("notification_quiet_hours")
        .delete()
        .eq("user_id", uid);
      await loose(admin)
        .from("notification_channel_preferences")
        .delete()
        .eq("user_id", uid);
      // Orphan system.test_push rows (null household) for these users.
      await loose(admin)
        .from("notification_deliveries")
        .delete()
        .eq("user_id", uid);
      const { data: ownNotes } = await loose(admin)
        .from("user_notifications")
        .select("id, event_id")
        .eq("user_id", uid);
      const eventIds = [
        ...new Set((ownNotes ?? []).map((n: { event_id: string }) => n.event_id)),
      ];
      await loose(admin).from("user_notifications").delete().eq("user_id", uid);
      if (eventIds.length) {
        await loose(admin)
          .from("notification_events")
          .delete()
          .in("id", eventIds)
          .is("household_id", null);
      }
    }
    await deleteTestAuthUsers(admin, createdUserIds);
  }, 180_000);


  it("1: user can upsert_push_subscription for self", async (ctx) => {
    if (!migrationReady) { ctx.skip("Phase 3.1 migration not applied") };
    const a = await authed(emailA, password);
    const endpoint = `https://push.example.test/endpoint/${runId}-a`;
    const res = await loose(a.client).rpc("upsert_push_subscription", {
      p_endpoint: endpoint,
      p_p256dh: "p256dh-key-value-long-enough",
      p_auth: "auth-key-value-long-enough",
      p_device_label: "iPhone Test",
      p_platform_category: "ios_pwa",
    });
    if (isMissingFeature(res.error)) {
      ctx.skip(true, "upsert_push_subscription missing");
    }
    expect(res.error).toBeNull();
    expect(res.data).toBeTruthy();

    const { data: row } = await loose(admin)
      .from("push_subscriptions")
      .select("id, user_id, endpoint, active")
      .eq("id", res.data)
      .single();
    expect(row?.user_id).toBe(a.userId);
    expect(row?.endpoint).toBe(endpoint);
    expect(row?.active).toBe(true);
  });

  it("2: upsert binds to auth.uid() (no forged user_id)", async (ctx) => {
    if (!migrationReady) { ctx.skip("Phase 3.1 migration not applied") };
    const a = await authed(emailA, password);
    const endpoint = `https://push.example.test/endpoint/${runId}-forge`;
    const res = await loose(a.client).rpc("upsert_push_subscription", {
      p_endpoint: endpoint,
      p_p256dh: "p256dh-key-value-long-enough",
      p_auth: "auth-key-value-long-enough",
      p_device_label: "Forge Check",
    });
    if (isMissingFeature(res.error)) {
      ctx.skip(true, "upsert_push_subscription missing");
    }
    expect(res.error).toBeNull();

    const { data: row } = await loose(admin)
      .from("push_subscriptions")
      .select("user_id")
      .eq("id", res.data)
      .single();
    expect(row?.user_id).toBe(a.userId);
    expect(row?.user_id).not.toBe(userIdB);
  });

  it("3+4: cannot read raw endpoints or other members' device rows", async (ctx) => {
    if (!migrationReady) { ctx.skip("Phase 3.1 migration not applied") };
    const a = await authed(emailA, password);
    const b = await authed(emailB, password);

    const upsertB = await loose(b.client).rpc("upsert_push_subscription", {
      p_endpoint: `https://push.example.test/endpoint/${runId}-b`,
      p_p256dh: "p256dh-key-value-long-enough",
      p_auth: "auth-key-value-long-enough",
      p_device_label: "B Device",
    });
    if (isMissingFeature(upsertB.error)) {
      ctx.skip(true, "upsert_push_subscription missing");
    }
    expect(upsertB.error).toBeNull();

    // Column revoke: selecting endpoint as authenticated should fail or omit secrets.
    const raw = await loose(a.client)
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth");
    if (raw.error) {
      expect(raw.error.message.toLowerCase()).toMatch(
        /permission|column|denied|not available|not grant/i,
      );
    } else {
      for (const row of raw.data ?? []) {
        expect(row.endpoint).toBeUndefined();
        expect(row.p256dh).toBeUndefined();
        expect(row.auth).toBeUndefined();
      }
    }

    // Own-row RLS: A must not see B's device list rows.
    const devicesAsA = await loose(a.client)
      .from("push_subscription_devices")
      .select("id, user_id")
      .eq("user_id", userIdB);
    if (isMissingFeature(devicesAsA.error)) {
      ctx.skip(true, "push_subscription_devices missing");
    }
    expect(devicesAsA.error).toBeNull();
    expect(devicesAsA.data ?? []).toHaveLength(0);

    // Household member cannot read another member's raw endpoint via admin path contrast.
    const { data: adminRow } = await loose(admin)
      .from("push_subscriptions")
      .select("endpoint, user_id")
      .eq("id", upsertB.data)
      .single();
    expect(adminRow?.user_id).toBe(userIdB);
    expect(adminRow?.endpoint).toContain(runId);

    const devicesAsB = await loose(b.client)
      .from("push_subscription_devices")
      .select("id, user_id")
      .eq("user_id", userIdB);
    expect((devicesAsB.data ?? []).length).toBeGreaterThan(0);
  });

  it("5: user can deactivate own device", async (ctx) => {
    if (!migrationReady) { ctx.skip("Phase 3.1 migration not applied") };
    const a = await authed(emailA, password);
    const upsert = await loose(a.client).rpc("upsert_push_subscription", {
      p_endpoint: `https://push.example.test/endpoint/${runId}-deactivate`,
      p_p256dh: "p256dh-key-value-long-enough",
      p_auth: "auth-key-value-long-enough",
    });
    if (isMissingFeature(upsert.error)) {
      ctx.skip(true, "upsert_push_subscription missing");
    }
    expect(upsert.error).toBeNull();

    const deactivated = await loose(a.client).rpc(
      "deactivate_push_subscription",
      { p_subscription_id: upsert.data },
    );
    expect(deactivated.error).toBeNull();
    expect(deactivated.data).toBe(true);

    const { data: row } = await loose(admin)
      .from("push_subscriptions")
      .select("active, disabled_reason")
      .eq("id", upsert.data)
      .single();
    expect(row?.active).toBe(false);
    expect(row?.disabled_reason).toBeTruthy();
  });

  it("6: authenticated user cannot claim_notification_deliveries", async (ctx) => {
    if (!migrationReady) { ctx.skip("Phase 3.1 migration not applied") };
    const a = await authed(emailA, password);
    const claimed = await loose(a.client).rpc("claim_notification_deliveries", {
      p_batch_size: 1,
    });
    if (isMissingFeature(claimed.error)) {
      ctx.skip(true, "claim_notification_deliveries missing");
    }
    expect(claimed.error).toBeTruthy();
    expect(claimed.error!.message.toLowerCase()).toMatch(
      /service_role|permission|denied|not granted|claim/i,
    );
  });

  it("7+8: service_role claims batch; concurrent claims are exclusive", async (ctx) => {
    if (!migrationReady) { ctx.skip("Phase 3.1 migration not applied") };

    const eventInserts = await Promise.all(
      [0, 1].map(async (i) => {
        const key = `claim-seed-${runId}-${i}`;
        const { data, error } = await loose(admin)
          .from("notification_events")
          .insert({
            household_id: householdId,
            event_type: "system.test_push",
            entity_type: "system",
            entity_id: userIdA,
            payload: { source_type: "system", source_id: userIdA },
            idempotency_key: key,
          })
          .select("id")
          .single();
        expect(error).toBeNull();
        return data!.id as string;
      }),
    );

    const deliveryIds: string[] = [];
    for (const eventId of eventInserts) {
      const { data, error } = await loose(admin)
        .from("notification_deliveries")
        .insert({
          event_id: eventId,
          user_id: userIdA,
          channel: "web_push",
          status: "queued",
          available_at: new Date().toISOString(),
          idempotency_key: `${eventId}:${userIdA}:web_push:claim-seed`,
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      deliveryIds.push(data!.id);
    }

    const workerA = crypto.randomUUID();
    const workerB = crypto.randomUUID();
    const [c1, c2] = await Promise.all([
      loose(admin).rpc("claim_notification_deliveries", {
        p_batch_size: 1,
        p_worker_id: workerA,
        p_claim_ttl_seconds: 120,
      }),
      loose(admin).rpc("claim_notification_deliveries", {
        p_batch_size: 1,
        p_worker_id: workerB,
        p_claim_ttl_seconds: 120,
      }),
    ]);
    expect(c1.error).toBeNull();
    expect(c2.error).toBeNull();

    const ids1 = ((c1.data ?? []) as { id: string }[]).map((r) => r.id);
    const ids2 = ((c2.data ?? []) as { id: string }[]).map((r) => r.id);
    expect(ids1.length + ids2.length).toBeGreaterThanOrEqual(2);
    const overlap = ids1.filter((id) => ids2.includes(id));
    expect(overlap).toEqual([]);

    // At least our seeded ids should have been claimable exclusivity-wise.
    const claimedSeed = [...ids1, ...ids2].filter((id) =>
      deliveryIds.includes(id),
    );
    expect(new Set(claimedSeed).size).toBe(claimedSeed.length);
  });

  it("9: expired claim becomes available again", async (ctx) => {
    if (!migrationReady) { ctx.skip("Phase 3.1 migration not applied") };

    const { data: event, error: eventErr } = await loose(admin)
      .from("notification_events")
      .insert({
        household_id: householdId,
        event_type: "system.test_push",
        entity_type: "system",
        entity_id: userIdA,
        payload: { source_type: "system", source_id: userIdA },
        idempotency_key: `claim-expire-${runId}`,
      })
      .select("id")
      .single();
    expect(eventErr).toBeNull();

    const { data: delivery, error: delErr } = await loose(admin)
      .from("notification_deliveries")
      .insert({
        event_id: event!.id,
        user_id: userIdA,
        channel: "web_push",
        status: "claimed",
        available_at: new Date(Date.now() - 60_000).toISOString(),
        claimed_at: new Date(Date.now() - 60_000).toISOString(),
        claim_expires_at: new Date(Date.now() - 30_000).toISOString(),
        claim_token: crypto.randomUUID(),
        idempotency_key: `${event!.id}:${userIdA}:web_push:expire`,
      })
      .select("id")
      .single();
    expect(delErr).toBeNull();

    let found = false;
    for (let attempt = 0; attempt < 25 && !found; attempt += 1) {
      const reclaimed = await loose(admin).rpc("claim_notification_deliveries", {
        p_batch_size: 200,
        p_worker_id: crypto.randomUUID(),
        p_claim_ttl_seconds: 120,
      });
      expect(reclaimed.error).toBeNull();
      const ids = ((reclaimed.data ?? []) as { id: string }[]).map((r) => r.id);
      if (ids.includes(delivery!.id)) {
        found = true;
        break;
      }
      if (ids.length === 0) break;
    }
    expect(found).toBe(true);
  });

  it("10+11+16: payment submit notifies recipient with safe payload only", async (ctx) => {
    if (!migrationReady) { ctx.skip("Phase 3.1 migration not applied") };
    const b = await authed(emailB, password);
    const key = `notif-pay-${runId}`;
    const submitted = await b.client.rpc("submit_payment", {
      p_household_id: householdId,
      p_recipient_membership_id: memA,
      p_total_amount_cents: 200,
      p_external_method: "venmo",
      p_allocations: [
        { obligation_id: oblB, amount_cents: 200 },
      ] as unknown as Json,
      p_idempotency_key: key,
      p_external_reference: PLANTED_SECRET,
      p_private_note: `private ${PLANTED_SECRET}`,
    });
    expect(submitted.error).toBeNull();
    const paymentId = (submitted.data as { id: string }).id;

    const { data: events } = await loose(admin)
      .from("notification_events")
      .select("id, event_type, payload, entity_type, entity_id")
      .eq("idempotency_key", `payment.submitted:${paymentId}`);
    expect(events?.length).toBe(1);
    const event = events![0]!;
    expect(event.event_type).toBe("payment.awaiting_confirmation");
    expect(event.payload).toEqual({
      source_type: "payment",
      source_id: paymentId,
    });
    expect(JSON.stringify(event.payload)).not.toContain(PLANTED_SECRET);
    expect(JSON.stringify(event.payload)).not.toContain("private");

    const { data: notes } = await loose(admin)
      .from("user_notifications")
      .select("id, user_id, title, body")
      .eq("event_id", event.id);
    expect(notes?.length).toBe(1);
    expect(notes![0]!.user_id).toBe(userIdA);
    expect(`${notes![0]!.title} ${notes![0]!.body}`).not.toContain(
      PLANTED_SECRET,
    );

    const { data: deliveries } = await loose(admin)
      .from("notification_deliveries")
      .select("id, channel, last_error, status")
      .eq("event_id", event.id);
    const blob = JSON.stringify(deliveries ?? []);
    expect(blob).not.toContain(PLANTED_SECRET);
    expect(blob).not.toContain("WORKER_SECRET");
  });

  it("12: duplicate fan-out does not create duplicate user_notifications", async (ctx) => {
    if (!migrationReady) { ctx.skip("Phase 3.1 migration not applied") };
    const a = await authed(emailA, password);
    const first = await loose(a.client).rpc("enqueue_test_notification");
    if (isMissingFeature(first.error)) {
      ctx.skip(true, "enqueue_test_notification missing");
    }
    expect(first.error).toBeNull();
    const eventId = first.data as string;

    const { count: before } = await loose(admin)
      .from("user_notifications")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("user_id", userIdA);
    expect(before).toBe(1);

    // Unique constraint blocks a second row for the same (event_id, user_id).
    const dup = await loose(admin).from("user_notifications").insert({
      user_id: userIdA,
      event_id: eventId,
      household_id: null,
      title: "Duplicate should fail",
      body: "",
    });
    expect(dup.error).toBeTruthy();

    const { count: after } = await loose(admin)
      .from("user_notifications")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("user_id", userIdA);
    expect(after).toBe(1);
  });

  it("13: quiet hours delay web_push available_at but keep user_notifications", async (ctx) => {
    if (!migrationReady) { ctx.skip("Phase 3.1 migration not applied") };
    const a = await authed(emailA, password);

    // Degenerate window (start=end) ⇒ always quiet for non-urgent.
    const quiet = await loose(a.client).from("notification_quiet_hours").upsert({
      user_id: a.userId,
      enabled: true,
      start_local: "00:00:00",
      end_local: "00:00:00",
      time_zone: "America/Chicago",
      allow_urgent_override: true,
      preview_mode: "generic",
    });
    if (isMissingFeature(quiet.error)) {
      ctx.skip(true, "notification_quiet_hours missing");
    }
    expect(quiet.error).toBeNull();

    // Payment awaiting_confirmation is high (not urgent) → quiet hours apply.
    const b = await authed(emailB, password);
    const nowIso = new Date().toISOString();
    const submitted = await b.client.rpc("submit_payment", {
      p_household_id: householdId,
      p_recipient_membership_id: memA,
      p_total_amount_cents: 50,
      p_external_method: "venmo",
      p_allocations: [
        { obligation_id: oblB, amount_cents: 50 },
      ] as unknown as Json,
      p_idempotency_key: `notif-quiet-${runId}`,
    });
    expect(submitted.error).toBeNull();
    const paymentId = (submitted.data as { id: string }).id;

    const { data: event } = await loose(admin)
      .from("notification_events")
      .select("id")
      .eq("idempotency_key", `payment.submitted:${paymentId}`)
      .single();

    const { data: notes } = await loose(admin)
      .from("user_notifications")
      .select("id")
      .eq("event_id", event!.id)
      .eq("user_id", userIdA);
    expect((notes ?? []).length).toBe(1);

    const { data: push } = await loose(admin)
      .from("notification_deliveries")
      .select("available_at, status, channel")
      .eq("event_id", event!.id)
      .eq("user_id", userIdA)
      .eq("channel", "web_push")
      .maybeSingle();
    expect(push).toBeTruthy();
    expect(new Date(push!.available_at).getTime()).toBeGreaterThan(
      new Date(nowIso).getTime(),
    );
  });

  it("14: mark-read only affects owner", async (ctx) => {
    if (!migrationReady) { ctx.skip("Phase 3.1 migration not applied") };
    const a = await authed(emailA, password);
    const b = await authed(emailB, password);

    const { data: note } = await loose(admin)
      .from("user_notifications")
      .select("id, read_at, user_id")
      .eq("user_id", userIdA)
      .is("read_at", null)
      .limit(1)
      .maybeSingle();

    if (!note) {
      const enq = await loose(a.client).rpc("enqueue_test_notification");
      if (isMissingFeature(enq.error)) {
        ctx.skip(true, "enqueue_test_notification missing");
      }
      // Rate limit may apply if prior test used enqueue recently — insert via admin.
      if (enq.error) {
        const { data: evt } = await loose(admin)
          .from("notification_events")
          .insert({
            household_id: householdId,
            event_type: "system.test_push",
            entity_type: "system",
            entity_id: userIdA,
            payload: { source_type: "system", source_id: userIdA },
            idempotency_key: `mark-read-${runId}`,
          })
          .select("id")
          .single();
        await loose(admin).from("user_notifications").insert({
          user_id: userIdA,
          event_id: evt!.id,
          household_id: householdId,
          title: "Mark-read fixture",
          body: "",
        });
      }
    }

    const { data: target } = await loose(admin)
      .from("user_notifications")
      .select("id, read_at")
      .eq("user_id", userIdA)
      .is("read_at", null)
      .limit(1)
      .single();
    expect(target).toBeTruthy();

    const asB = await loose(b.client).rpc("mark_notification_read", {
      p_notification_id: target!.id,
    });
    expect(asB.error).toBeNull();

    const { data: afterB } = await loose(admin)
      .from("user_notifications")
      .select("read_at")
      .eq("id", target!.id)
      .single();
    expect(afterB?.read_at).toBeNull();

    const asA = await loose(a.client).rpc("mark_notification_read", {
      p_notification_id: target!.id,
    });
    expect(asA.error).toBeNull();
    const { data: afterA } = await loose(admin)
      .from("user_notifications")
      .select("read_at")
      .eq("id", target!.id)
      .single();
    expect(afterA?.read_at).toBeTruthy();
  });

  it("15: enqueue_test_notification works; second call rate-limited", async (ctx) => {
    if (!migrationReady) { ctx.skip("Phase 3.1 migration not applied") };
    const b = await authed(emailB, password);
    const first = await loose(b.client).rpc("enqueue_test_notification");
    if (isMissingFeature(first.error)) {
      ctx.skip(true, "enqueue_test_notification missing");
    }
    expect(first.error).toBeNull();
    expect(first.data).toBeTruthy();

    const second = await loose(b.client).rpc("enqueue_test_notification");
    expect(second.error).toBeTruthy();
    expect(second.error!.message.toLowerCase()).toMatch(/rate limit/);
  });
});
