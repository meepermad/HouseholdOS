import "server-only";

import { createClient } from "@/lib/supabase/server";
import { obligationPurchaseLabel, sourceFromMaps } from "@/lib/payments/obligation-source";
import { loadObligationPurchaseSources, listObligationBalances } from "@/lib/payments/queries";
import {
  BalanceReconciliationError,
  buildBalanceExplanation,
  type BalanceExplanation,
  type ExplanationLineInput,
  type ExplanationPayment,
} from "@/lib/money/balance-explanation";

export async function explainCounterpartyBalance(params: {
  householdId: string;
  viewerMembershipId: string;
  counterpartyMembershipId: string;
  counterpartyName: string;
  includeItemShares?: boolean;
}): Promise<{ explanation: BalanceExplanation } | { error: string }> {
  const balances = await listObligationBalances(params.householdId);
  const relevant = balances.filter((row) => {
    const people = [row.debtor_membership_id, row.creditor_membership_id];
    return (
      people.includes(params.viewerMembershipId) &&
      people.includes(params.counterpartyMembershipId)
    );
  });
  const sources = await loadObligationPurchaseSources(
    params.householdId,
    relevant.map((row) => row.expense_id),
  );
  const supabase = await createClient();
  const obligationIds = relevant.map((row) => row.obligation_id);
  const openingIds = relevant
    .filter((row) => row.obligation_kind === "opening_balance")
    .map((row) => row.obligation_id);

  const [{ data: allocationRows }, { data: openings }] = await Promise.all([
    obligationIds.length
      ? supabase
          .from("payment_allocations")
          .select("obligation_id, amount_cents, payment_id")
          .eq("household_id", params.householdId)
          .in("obligation_id", obligationIds)
      : Promise.resolve({ data: [] as Array<{ obligation_id: string; amount_cents: number; payment_id: string }> }),
    openingIds.length
      ? supabase
          .from("opening_balance_entries")
          .select("obligation_id, effective_date, created_by_membership_id, explanation")
          .eq("household_id", params.householdId)
          .in("obligation_id", openingIds)
      : Promise.resolve({
          data: [] as Array<{
            obligation_id: string | null;
            effective_date: string;
            created_by_membership_id: string;
            explanation: string;
          }>,
        }),
  ]);

  const paymentIds = [...new Set((allocationRows ?? []).map((row) => row.payment_id))];
  const { data: paymentRows } = paymentIds.length
    ? await supabase
        .from("payments")
        .select(
          "id, status, total_amount_cents, confirmed_at, submitted_at, created_by_membership_id, sender_membership_id",
        )
        .eq("household_id", params.householdId)
        .in("id", paymentIds)
    : { data: [] as Array<{
        id: string;
        status: string;
        total_amount_cents: number;
        confirmed_at: string | null;
        submitted_at: string | null;
        created_by_membership_id: string;
        sender_membership_id: string;
      }> };

  const paymentById = new Map((paymentRows ?? []).map((row) => [row.id, row]));
  const openingByObligation = new Map(
    (openings ?? [])
      .filter((row) => row.obligation_id)
      .map((row) => [row.obligation_id as string, row]),
  );

  const lines: ExplanationLineInput[] = [];
  for (const row of relevant) {
    const source = sourceFromMaps(row.expense_id, row.obligation_kind, sources);
    const opening = openingByObligation.get(row.obligation_id);
    const payments: ExplanationPayment[] = (allocationRows ?? [])
      .filter((allocation) => allocation.obligation_id === row.obligation_id)
      .map((allocation) => {
        const payment = paymentById.get(allocation.payment_id);
        const when = payment?.confirmed_at || payment?.submitted_at;
        const recordedByRecipient =
          payment?.created_by_membership_id &&
          payment.created_by_membership_id !== payment.sender_membership_id;
        return {
          id: allocation.payment_id,
          label: when
            ? `${when.slice(0, 10)}${recordedByRecipient ? " · payment received" : " · payment reported"}`
            : "Payment",
          amountCents: allocation.amount_cents,
          href: `/app/${params.householdId}/money/payments/${allocation.payment_id}`,
          status: payment?.status ?? "submitted",
        };
      });
    let itemShares: Array<{ description: string; amountCents: number }> = [];
    if (params.includeItemShares && row.expense_id) {
      itemShares = await loadItemShares(
        params.householdId,
        row.expense_id,
        row.debtor_membership_id,
      );
    }
    lines.push({
      id: row.obligation_id,
      householdId: row.household_id,
      label: obligationPurchaseLabel(source),
      debtorMembershipId: row.debtor_membership_id,
      creditorMembershipId: row.creditor_membership_id,
      obligationKind: row.obligation_kind,
      hasReceipt: Boolean(source.receiptId),
      originalAmountCents: row.original_amount_cents,
      effectiveAmountCents: row.effective_amount_cents,
      confirmedPaidCents: row.confirmed_paid_cents,
      pendingPaymentCents: row.pending_payment_cents,
      waivedCents: row.waived_cents,
      officialOutstandingCents: row.official_outstanding_cents,
      storedStatus: row.stored_status,
      href: `/app/${params.householdId}/money/reimbursements/${row.obligation_id}`,
      receiptHref: source.receiptId
        ? `/app/${params.householdId}/money/receipts/${source.receiptId}`
        : null,
      sourceNote: opening
        ? `Opening balance of this amount, effective ${opening.effective_date}. ${opening.explanation}`
        : null,
      payments,
      itemShares,
    });
  }

  try {
    return {
      explanation: buildBalanceExplanation({
        viewerMembershipId: params.viewerMembershipId,
        counterpartyMembershipId: params.counterpartyMembershipId,
        counterpartyName: params.counterpartyName,
        lines,
      }),
    };
  } catch (error) {
    if (error instanceof BalanceReconciliationError) {
      return { error: "This balance could not be reconciled with the ledger." };
    }
    throw error;
  }
}

async function loadItemShares(
  householdId: string,
  expenseId: string,
  membershipId: string,
): Promise<Array<{ description: string; amountCents: number }>> {
  const supabase = await createClient();
  const [{ data: items }, { data: allocations }, { data: adjustments }, { data: adjustmentAllocations }] =
    await Promise.all([
      supabase
        .from("expense_items")
        .select("id, description, total_cents")
        .eq("household_id", householdId)
        .eq("expense_id", expenseId),
      supabase
        .from("expense_item_allocations")
        .select("item_id, membership_id, amount_cents")
        .eq("household_id", householdId)
        .eq("expense_id", expenseId)
        .eq("membership_id", membershipId),
      supabase
        .from("expense_adjustments")
        .select("id, description, amount_cents")
        .eq("household_id", householdId)
        .eq("expense_id", expenseId),
      supabase
        .from("expense_adjustment_allocations")
        .select("adjustment_id, membership_id, amount_cents")
        .eq("household_id", householdId)
        .eq("expense_id", expenseId)
        .eq("membership_id", membershipId),
    ]);
  const shares: Array<{ description: string; amountCents: number }> = [];
  for (const allocation of allocations ?? []) {
    if (allocation.amount_cents === 0) continue;
    const item = (items ?? []).find((row) => row.id === allocation.item_id);
    shares.push({
      description: item?.description || "Item",
      amountCents: allocation.amount_cents,
    });
  }
  for (const allocation of adjustmentAllocations ?? []) {
    if (allocation.amount_cents === 0) continue;
    const adjustment = (adjustments ?? []).find((row) => row.id === allocation.adjustment_id);
    shares.push({
      description: adjustment?.description || "Tax or adjustment",
      amountCents: allocation.amount_cents,
    });
  }
  return shares;
}
