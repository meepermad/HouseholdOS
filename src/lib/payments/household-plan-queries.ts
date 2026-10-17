import { createClient } from "@/lib/supabase/server";
import {
  planHouseholdSettlement,
  type HouseholdSettlementPlan,
} from "@/lib/payments/household-plan";
import type { DirectedObligationEdge } from "@/lib/payments/routed-suggestions";

export type OpenHouseholdPayment = {
  id: string;
  payerMembershipId: string;
  recipientMembershipId: string;
  amountCents: number;
  currency: string;
  status: string;
};

export type HouseholdSettlementView = {
  plan: HouseholdSettlementPlan;
  openPayments: OpenHouseholdPayment[];
  recordingReady: boolean;
};

type BalanceRow = {
  obligation_id: string | null;
  debtor_membership_id: string | null;
  creditor_membership_id: string | null;
  official_outstanding_cents: number | null;
  pending_payment_cents: number | null;
  expense_id: string | null;
};

type OpenRow = {
  id: string;
  payer_membership_id: string;
  recipient_membership_id: string;
  amount_cents: number;
  currency: string;
  status: string;
};

type LegRow = {
  household_net_payment_id: string;
  obligation_id: string;
  amount_cents: number;
};

function missingNetTable(error: { message: string; code?: string }): boolean {
  const message = error.message.toLowerCase();
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    message.includes("household_net_payments") ||
    message.includes("schema cache")
  );
}

export async function loadHouseholdSettlementView(
  householdId: string,
): Promise<HouseholdSettlementView> {
  const supabase = await createClient();
  const { data: balances, error } = await supabase
    .from("obligation_balances_v")
    .select(
      "obligation_id, debtor_membership_id, creditor_membership_id, official_outstanding_cents, pending_payment_cents, expense_id",
    )
    .eq("household_id", householdId)
    .gt("official_outstanding_cents", 0);
  if (error) throw error;

  const { data: household } = await supabase
    .from("households")
    .select("currency")
    .eq("id", householdId)
    .maybeSingle();
  const householdCurrency = household?.currency ?? "USD";

  const rows = (balances ?? []) as BalanceRow[];
  const expenseIds = [
    ...new Set(
      rows.map((row) => row.expense_id).filter((id): id is string => Boolean(id)),
    ),
  ];
  const currencyByExpense = new Map<string, string>();
  if (expenseIds.length > 0) {
    const { data: expenses } = await supabase
      .from("expenses")
      .select("id, currency")
      .in("id", expenseIds);
    for (const expense of expenses ?? []) {
      currencyByExpense.set(expense.id, expense.currency);
    }
  }

  const { data: disputes, error: disputeError } = await supabase
    .from("reimbursement_disputes")
    .select("obligation_id, expense_id")
    .eq("household_id", householdId)
    .in("status", ["open", "under_review"]);
  if (disputeError) throw disputeError;
  const disputedObligations = new Set(
    (disputes ?? [])
      .map((dispute) => dispute.obligation_id)
      .filter((id): id is string => Boolean(id)),
  );
  const disputedExpenses = new Set(
    (disputes ?? [])
      .map((dispute) => dispute.expense_id)
      .filter((id): id is string => Boolean(id)),
  );

  const { data: reservations } = await supabase
    .from("routed_settlement_reservations")
    .select("obligation_id, amount_cents")
    .eq("household_id", householdId)
    .eq("status", "active");
  const reserved = new Map<string, number>();
  for (const reservation of reservations ?? []) {
    reserved.set(
      reservation.obligation_id,
      (reserved.get(reservation.obligation_id) ?? 0) + reservation.amount_cents,
    );
  }

  const loose = supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          eq: (
            column: string,
            value: string,
          ) => Promise<{
            data: OpenRow[] | null;
            error: { message: string; code?: string } | null;
          }>;
        };
        in: (
          column: string,
          values: string[],
        ) => Promise<{
          data: LegRow[] | null;
          error: { message: string; code?: string } | null;
        }>;
      };
    };
  };

  const openResult = await loose
    .from("household_net_payments")
    .select(
      "id, payer_membership_id, recipient_membership_id, amount_cents, currency, status",
    )
    .eq("household_id", householdId)
    .eq("status", "submitted");

  let recordingReady = true;
  const openPayments: OpenHouseholdPayment[] = [];
  if (openResult.error) {
    if (!missingNetTable(openResult.error)) throw openResult.error;
    recordingReady = false;
  } else {
    for (const row of openResult.data ?? []) {
      openPayments.push({
        id: row.id,
        payerMembershipId: row.payer_membership_id,
        recipientMembershipId: row.recipient_membership_id,
        amountCents: row.amount_cents,
        currency: row.currency,
        status: row.status,
      });
    }
    if (openPayments.length > 0) {
      const legResult = await loose
        .from("household_net_payment_legs")
        .select("household_net_payment_id, obligation_id, amount_cents")
        .in(
          "household_net_payment_id",
          openPayments.map((payment) => payment.id),
        );
      if (legResult.error) throw legResult.error;
      for (const leg of legResult.data ?? []) {
        reserved.set(
          leg.obligation_id,
          (reserved.get(leg.obligation_id) ?? 0) + leg.amount_cents,
        );
      }
    }
  }

  const edges: DirectedObligationEdge[] = [];
  for (const row of rows) {
    if (!row.obligation_id || !row.debtor_membership_id || !row.creditor_membership_id) {
      continue;
    }
    if (disputedObligations.has(row.obligation_id)) continue;
    if (row.expense_id && disputedExpenses.has(row.expense_id)) continue;
    const currency = row.expense_id
      ? (currencyByExpense.get(row.expense_id) ?? householdCurrency)
      : householdCurrency;
    if (currency !== householdCurrency) continue;
    const available = Math.max(
      0,
      Number(row.official_outstanding_cents) -
        Number(row.pending_payment_cents) -
        (reserved.get(row.obligation_id) ?? 0),
    );
    if (available <= 0) continue;
    edges.push({
      obligationId: row.obligation_id,
      debtorMembershipId: row.debtor_membership_id,
      creditorMembershipId: row.creditor_membership_id,
      availableCents: available,
      currency,
    });
  }

  return {
    plan: planHouseholdSettlement(edges),
    openPayments,
    recordingReady,
  };
}
