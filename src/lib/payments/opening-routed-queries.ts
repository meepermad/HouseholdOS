import { createClient } from "@/lib/supabase/server";
import {
  suggestRoutedSettlements,
  type DirectedObligationEdge,
  type RoutedSettlementSuggestion,
} from "@/lib/payments/routed-suggestions";

export type OpeningBalanceListItem = {
  id: string;
  status: string;
  amount_cents: number;
  currency: string;
  effective_date: string;
  explanation: string;
  debtor_membership_id: string;
  creditor_membership_id: string;
  created_by_membership_id: string;
  obligation_id: string | null;
  created_at: string;
};

export async function listOpeningBalances(
  householdId: string,
): Promise<OpeningBalanceListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opening_balance_entries")
    .select(
      "id, status, amount_cents, currency, effective_date, explanation, debtor_membership_id, creditor_membership_id, created_by_membership_id, obligation_id, created_at",
    )
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as OpeningBalanceListItem[];
}

export async function getOpeningBalance(
  householdId: string,
  entryId: string,
): Promise<OpeningBalanceListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opening_balance_entries")
    .select(
      "id, status, amount_cents, currency, effective_date, explanation, debtor_membership_id, creditor_membership_id, created_by_membership_id, obligation_id, created_at",
    )
    .eq("household_id", householdId)
    .eq("id", entryId)
    .maybeSingle();
  if (error) throw error;
  return data as OpeningBalanceListItem | null;
}

export type RoutedProposalListItem = {
  id: string;
  status: string;
  amount_cents: number;
  currency: string;
  payer_membership_id: string;
  intermediary_membership_id: string;
  recipient_membership_id: string;
  source_obligation_ab_id: string;
  source_obligation_bc_id: string;
  payment_id: string | null;
  created_at: string;
};

export async function listRoutedProposals(
  householdId: string,
): Promise<RoutedProposalListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("routed_settlement_proposals")
    .select(
      "id, status, amount_cents, currency, payer_membership_id, intermediary_membership_id, recipient_membership_id, source_obligation_ab_id, source_obligation_bc_id, payment_id, created_at",
    )
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data ?? []) as RoutedProposalListItem[];
}

export async function getRoutedProposal(
  householdId: string,
  proposalId: string,
): Promise<RoutedProposalListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("routed_settlement_proposals")
    .select(
      "id, status, amount_cents, currency, payer_membership_id, intermediary_membership_id, recipient_membership_id, source_obligation_ab_id, source_obligation_bc_id, payment_id, created_at",
    )
    .eq("household_id", householdId)
    .eq("id", proposalId)
    .maybeSingle();
  if (error) throw error;
  return data as RoutedProposalListItem | null;
}

export async function loadSimplifySuggestions(
  householdId: string,
): Promise<RoutedSettlementSuggestion[]> {
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

  const expenseIds = [
    ...new Set(
      (balances ?? [])
        .map((b) => b.expense_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const currencyByExpense = new Map<string, string>();
  if (expenseIds.length > 0) {
    const { data: expenses } = await supabase
      .from("expenses")
      .select("id, currency")
      .in("id", expenseIds);
    for (const e of expenses ?? []) {
      currencyByExpense.set(e.id, e.currency);
    }
  }

  const { data: reservations } = await supabase
    .from("routed_settlement_reservations")
    .select("obligation_id, amount_cents")
    .eq("household_id", householdId)
    .eq("status", "active");
  const reserved = new Map<string, number>();
  for (const r of reservations ?? []) {
    reserved.set(
      r.obligation_id,
      (reserved.get(r.obligation_id) ?? 0) + r.amount_cents,
    );
  }

  const edges: DirectedObligationEdge[] = (balances ?? [])
    .filter(
      (b): b is typeof b & {
        obligation_id: string;
        debtor_membership_id: string;
        creditor_membership_id: string;
      } =>
        Boolean(
          b.obligation_id &&
            b.debtor_membership_id &&
            b.creditor_membership_id,
        ),
    )
    .map((b) => {
      const available = Math.max(
        0,
        Number(b.official_outstanding_cents) -
          Number(b.pending_payment_cents) -
          (reserved.get(b.obligation_id) ?? 0),
      );
      return {
        obligationId: b.obligation_id,
        debtorMembershipId: b.debtor_membership_id,
        creditorMembershipId: b.creditor_membership_id,
        availableCents: available,
        currency: b.expense_id
          ? (currencyByExpense.get(b.expense_id) ?? householdCurrency)
          : householdCurrency,
      };
    });

  return suggestRoutedSettlements(edges);
}
