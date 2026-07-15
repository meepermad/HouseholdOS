import { createClient } from "@/lib/supabase/server";
import {
  computeMemberBalanceSummary,
  computePairwiseBalances,
  type MemberBalanceSummary,
  type PairwiseBalance,
} from "@/lib/payments";

export type ObligationBalanceRow = {
  obligation_id: string;
  household_id: string;
  expense_id: string;
  debtor_membership_id: string;
  creditor_membership_id: string;
  obligation_kind: string;
  stored_status: string;
  original_amount_cents: number;
  effective_amount_cents: number;
  confirmed_paid_cents: number;
  pending_payment_cents: number;
  waived_cents: number;
  official_outstanding_cents: number;
  projected_outstanding_cents: number;
  settlement_state: string;
  created_at: string;
  updated_at: string;
};

export async function listObligationBalances(
  householdId: string,
): Promise<ObligationBalanceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("obligation_balances_v")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ObligationBalanceRow[];
}

export async function getObligationBalance(
  householdId: string,
  obligationId: string,
): Promise<ObligationBalanceRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("obligation_balances_v")
    .select("*")
    .eq("household_id", householdId)
    .eq("obligation_id", obligationId)
    .maybeSingle();
  if (error) throw error;
  return (data as ObligationBalanceRow | null) ?? null;
}

export async function getSettlementBalancesForMembership(
  householdId: string,
  membershipId: string,
): Promise<{
  summary: MemberBalanceSummary;
  pairwise: PairwiseBalance[];
}> {
  const rows = await listObligationBalances(householdId);
  const mine = rows.filter(
    (r) =>
      r.debtor_membership_id === membershipId ||
      r.creditor_membership_id === membershipId,
  );

  const officialOwedByMe = mine
    .filter((r) => r.debtor_membership_id === membershipId)
    .map((r) => r.official_outstanding_cents);
  const officialOwedToMe = mine
    .filter((r) => r.creditor_membership_id === membershipId)
    .map((r) => r.official_outstanding_cents);
  const pendingOutgoing = mine
    .filter((r) => r.debtor_membership_id === membershipId)
    .map((r) => r.pending_payment_cents);
  const pendingIncoming = mine
    .filter((r) => r.creditor_membership_id === membershipId)
    .map((r) => r.pending_payment_cents);

  const counterparties = new Set<string>();
  for (const r of mine) {
    if (r.debtor_membership_id === membershipId) {
      counterparties.add(r.creditor_membership_id);
    } else {
      counterparties.add(r.debtor_membership_id);
    }
  }

  const pairwiseInput = [...counterparties].map((c) => {
    const iOweThemOfficialCents = mine
      .filter(
        (r) =>
          r.debtor_membership_id === membershipId &&
          r.creditor_membership_id === c,
      )
      .reduce((s, r) => s + r.official_outstanding_cents, 0);
    const theyOweMeOfficialCents = mine
      .filter(
        (r) =>
          r.creditor_membership_id === membershipId &&
          r.debtor_membership_id === c,
      )
      .reduce((s, r) => s + r.official_outstanding_cents, 0);
    const pendingOutgoingCents = mine
      .filter(
        (r) =>
          r.debtor_membership_id === membershipId &&
          r.creditor_membership_id === c,
      )
      .reduce((s, r) => s + r.pending_payment_cents, 0);
    const pendingIncomingCents = mine
      .filter(
        (r) =>
          r.creditor_membership_id === membershipId &&
          r.debtor_membership_id === c,
      )
      .reduce((s, r) => s + r.pending_payment_cents, 0);
    return {
      counterpartyMembershipId: c,
      iOweThemOfficialCents,
      theyOweMeOfficialCents,
      pendingOutgoingCents,
      pendingIncomingCents,
    };
  });

  return {
    summary: computeMemberBalanceSummary({
      officialOwedByMe,
      officialOwedToMe,
      pendingOutgoing,
      pendingIncoming,
    }),
    pairwise: computePairwiseBalances(pairwiseInput),
  };
}

export async function listPayments(
  householdId: string,
  opts: { limit?: number; offset?: number } = {},
) {
  const supabase = await createClient();
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, sender_membership_id, recipient_membership_id, total_amount_cents, external_method, status, submitted_at, confirmed_at, claimed_paid_at, public_note, created_at",
    )
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data ?? [];
}

export async function getPaymentDetail(householdId: string, paymentId: string) {
  const supabase = await createClient();
  const [{ data: payment, error }, { data: allocations }, { data: privateDetails }, { data: reversal }] =
    await Promise.all([
      supabase
        .from("payments")
        .select("*")
        .eq("household_id", householdId)
        .eq("id", paymentId)
        .maybeSingle(),
      supabase
        .from("payment_allocations")
        .select("id, obligation_id, amount_cents, created_at")
        .eq("payment_id", paymentId)
        .eq("household_id", householdId),
      supabase
        .from("payment_private_details")
        .select("private_note, external_reference")
        .eq("payment_id", paymentId)
        .maybeSingle(),
      supabase
        .from("payment_reversals")
        .select("id, reason, reversed_by_membership_id, created_at")
        .eq("payment_id", paymentId)
        .maybeSingle(),
    ]);
  if (error) throw error;
  if (!payment) return null;
  return {
    payment,
    allocations: allocations ?? [],
    privateDetails: privateDetails ?? null,
    reversal: reversal ?? null,
  };
}

export async function listDisputes(householdId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reimbursement_disputes")
    .select(
      "id, dispute_type, reason, status, expense_id, obligation_id, payment_id, raised_by_membership_id, resolution_type, created_at, resolved_at",
    )
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function getDisputeDetail(householdId: string, disputeId: string) {
  const supabase = await createClient();
  const [{ data: dispute }, { data: events }] = await Promise.all([
    supabase
      .from("reimbursement_disputes")
      .select("*")
      .eq("household_id", householdId)
      .eq("id", disputeId)
      .maybeSingle(),
    supabase
      .from("dispute_events")
      .select("id, event_type, note, actor_membership_id, created_at")
      .eq("dispute_id", disputeId)
      .eq("household_id", householdId)
      .order("created_at", { ascending: true }),
  ]);
  if (!dispute) return null;
  return { dispute, events: events ?? [] };
}

export async function listLedgerEvents(
  householdId: string,
  opts: { limit?: number } = {},
) {
  const supabase = await createClient();
  const limit = opts.limit ?? 80;
  const { data, error } = await supabase
    .from("audit_events")
    .select(
      "id, entity_type, entity_id, event_type, after_state, reason, created_at, actor_user_id",
    )
    .eq("household_id", householdId)
    .in("event_type", [
      "expense.confirmed",
      "expense.amended",
      "expense.voided",
      "reimbursement.created",
      "reimbursement.adjusted",
      "reimbursement.reversed",
      "reimbursement.waived",
      "reimbursement.partially_settled",
      "reimbursement.settled",
      "reimbursement.reopened",
      "payment.submitted",
      "payment.confirmed",
      "payment.rejected",
      "payment.cancelled",
      "payment.reversed",
      "payment.allocation_created",
      "waiver.reversed",
      "dispute.opened",
      "dispute.resolved",
      "dispute.withdrawn",
      "refund_obligation.created",
    ])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listActionCenterItems(
  householdId: string,
  membershipId: string,
  userId: string,
) {
  const supabase = await createClient();
  const [
    { data: awaitingConfirm },
    { data: notifications },
    { data: openDisputes },
    { data: refunds },
  ] = await Promise.all([
    supabase
      .from("payments")
      .select("id, total_amount_cents, external_method, sender_membership_id, submitted_at")
      .eq("household_id", householdId)
      .eq("recipient_membership_id", membershipId)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true }),
    supabase
      .from("user_notifications")
      .select("id, title, body, action_href, created_at, read_at, event_id")
      .eq("user_id", userId)
      .eq("household_id", householdId)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("reimbursement_disputes")
      .select("id, dispute_type, reason, status, created_at")
      .eq("household_id", householdId)
      .in("status", ["open", "under_review"])
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("obligation_balances_v")
      .select(
        "obligation_id, official_outstanding_cents, debtor_membership_id, creditor_membership_id, obligation_kind",
      )
      .eq("household_id", householdId)
      .eq("obligation_kind", "refund")
      .eq("debtor_membership_id", membershipId)
      .gt("official_outstanding_cents", 0),
  ]);

  return {
    awaitingConfirm: awaitingConfirm ?? [],
    notifications: notifications ?? [],
    openDisputes: openDisputes ?? [],
    refundsOwed: refunds ?? [],
  };
}
