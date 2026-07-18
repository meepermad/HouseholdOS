import "server-only";

import { createClient } from "@/lib/supabase/server";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import {
  getSettlementBalancesForMembership,
  listObligationBalances,
} from "@/lib/payments/queries";
import { suggestRoutedSettlements } from "@/lib/payments/routed-suggestions";
import { can } from "@/lib/permissions";
import { getLaunchFeatureReadiness } from "@/lib/launch/feature-readiness";
import {
  formatDisputeAttention,
  formatExpenseDraftAttention,
  formatExpenseReviewAttention,
  formatOpeningBalanceAttention,
  formatPaymentConfirmAttention,
  formatPaymentSenderAttention,
  formatReceiptDraftAttention,
  formatRefundAttention,
  formatRoutedAttention,
  sortAttentionItems,
  type AttentionItem,
} from "@/lib/money/attention";
import {
  activityStatusLabel,
  formatActivityDescription,
  sortActivity,
  type ActivityItem,
} from "@/lib/money/activity";
import {
  computeMonthlyFinancialSummary,
  defaultMonthKey,
  type MonthlyFinancialSummary,
} from "@/lib/money/monthly-summary";
import { selectPrimaryActions, type PrimaryAction } from "@/lib/money/primary-actions";
import { shiftMonth } from "@/lib/money/list-filters";
import type { MemberBalanceSummary, PairwiseBalance } from "@/lib/payments/types";
import type { HouseholdResponsibility } from "@/types/database";

export const MONEY_OVERVIEW_VERSION = 1;

export type PairwiseHubRow = {
  counterpartyMembershipId: string;
  displayName: string;
  officialNetCents: number;
  pendingOutgoingCents: number;
  pendingIncomingCents: number;
  /** Positive: you owe them; negative: they owe you. */
  youOweCents: number;
  theyOweYouCents: number;
};

export type MoneyOverview = {
  version: typeof MONEY_OVERVIEW_VERSION;
  householdId: string;
  membershipId: string;
  fetchedAt: string;
  activeMemberCount: number;
  isSingleMember: boolean;
  balance: MemberBalanceSummary;
  primaryActions: PrimaryAction[];
  attention: AttentionItem[];
  pairwise: PairwiseHubRow[];
  settledHiddenCount: number;
  routedSuggestionAvailable: boolean;
  monthly: MonthlyFinancialSummary;
  activity: ActivityItem[];
  tools: MoneyToolsGroups;
  canInvite: boolean;
};

export type MoneyToolsGroups = {
  records: { label: string; href: string; testId?: string }[];
  balanceTools: { label: string; href: string; testId?: string }[];
  receiptsReporting: { label: string; href: string; testId?: string }[];
  settings: { label: string; href: string; testId?: string }[];
};

export async function loadMoneyOverview(params: {
  householdId: string;
  membershipId: string;
  userId: string;
  roles: HouseholdResponsibility[];
  month?: string;
}): Promise<MoneyOverview> {
  const { householdId, membershipId, userId, roles } = params;
  const month = params.month ?? defaultMonthKey();
  const supabase = await createClient();
  const launch = await getLaunchFeatureReadiness();
  const members = await listActiveMemberOptions(householdId);
  const nameOf = (id: string) =>
    members.find((m) => m.id === id)?.label ?? "Roommate";

  const [
    settlement,
    obligations,
    awaitingConfirm,
    mySubmitted,
    receiptDrafts,
    myDraftExpenses,
    reviewExpenses,
    openingPending,
    routedRows,
    disputes,
    expensesForMonth,
    paymentsForMonth,
    utilities,
    recentExpenses,
    recentPayments,
    recentDisputes,
    recentRouted,
  ] = await Promise.all([
    getSettlementBalancesForMembership(householdId, membershipId),
    listObligationBalances(householdId),
    supabase
      .from("payments")
      .select("id, total_amount_cents, sender_membership_id, submitted_at")
      .eq("household_id", householdId)
      .eq("recipient_membership_id", membershipId)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true })
      .limit(20),
    supabase
      .from("payments")
      .select("id, total_amount_cents, status, submitted_at")
      .eq("household_id", householdId)
      .eq("sender_membership_id", membershipId)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true })
      .limit(10),
    launch.receipts
      ? supabase
          .from("expense_receipts")
          .select("id")
          .eq("household_id", householdId)
          .eq("uploaded_by_membership_id", membershipId)
          .in("status", ["uploaded", "extracting", "needs_review"])
          .is("deleted_at", null)
          .limit(50)
      : Promise.resolve({ data: [] as { id: string }[] }),
    supabase
      .from("expenses")
      .select("id, merchant, status")
      .eq("household_id", householdId)
      .eq("created_by_membership_id", membershipId)
      .eq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("expenses")
      .select("id, merchant, status")
      .eq("household_id", householdId)
      .eq("status", "ready_for_review")
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("opening_balance_entries")
      .select("id, amount_cents, status, creditor_membership_id, debtor_membership_id")
      .eq("household_id", householdId)
      .eq("status", "awaiting_confirmation")
      .limit(20),
    supabase
      .from("routed_settlement_proposals")
      .select(
        "id, status, amount_cents, payer_membership_id, intermediary_membership_id, recipient_membership_id",
      )
      .eq("household_id", householdId)
      .in("status", [
        "awaiting_intermediary_approval",
        "awaiting_recipient_acceptance",
        "ready_to_pay",
        "stale",
      ])
      .limit(20),
    supabase
      .from("reimbursement_disputes")
      .select("id, status, created_at")
      .eq("household_id", householdId)
      .in("status", ["open", "under_review"])
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("expenses")
      .select(
        "id, merchant, category, purchase_date, declared_total_cents, status",
      )
      .eq("household_id", householdId)
      .gte("purchase_date", `${shiftMonth(month, -1)}-01`)
      .lt("purchase_date", `${shiftMonth(month, 1)}-01`)
      .limit(200),
    supabase
      .from("payments")
      .select(
        "id, total_amount_cents, status, submitted_at, confirmed_at",
      )
      .eq("household_id", householdId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("household_utilities")
      .select("estimated_amount_cents, actual_amount_cents")
      .eq("household_id", householdId)
      .limit(40),
    supabase
      .from("expenses")
      .select(
        "id, merchant, declared_total_cents, status, purchase_date, confirmed_at, created_at, updated_at, category",
      )
      .eq("household_id", householdId)
      .order("updated_at", { ascending: false })
      .limit(12),
    supabase
      .from("payments")
      .select(
        "id, total_amount_cents, status, submitted_at, confirmed_at, created_at, sender_membership_id, recipient_membership_id",
      )
      .eq("household_id", householdId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("reimbursement_disputes")
      .select("id, status, created_at, resolved_at")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("routed_settlement_proposals")
      .select("id, status, amount_cents, created_at, updated_at")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const refunds = obligations.filter(
    (r) =>
      r.obligation_kind === "refund" &&
      r.debtor_membership_id === membershipId &&
      r.official_outstanding_cents > 0,
  );

  const attention: AttentionItem[] = [];

  for (const d of disputes.data ?? []) {
    attention.push(
      formatDisputeAttention({ disputeId: d.id, householdId }),
    );
  }

  for (const p of awaitingConfirm.data ?? []) {
    attention.push(
      formatPaymentConfirmAttention({
        paymentId: p.id,
        amountCents: p.total_amount_cents,
        senderLabel: nameOf(p.sender_membership_id),
        householdId,
      }),
    );
  }

  for (const p of mySubmitted.data ?? []) {
    attention.push(
      formatPaymentSenderAttention({
        paymentId: p.id,
        amountCents: p.total_amount_cents,
        householdId,
      }),
    );
  }

  for (const r of refunds) {
    attention.push(
      formatRefundAttention({
        obligationId: r.obligation_id,
        amountCents: r.official_outstanding_cents,
        householdId,
      }),
    );
  }

  for (const entry of openingPending.data ?? []) {
    const involvesMe =
      entry.creditor_membership_id === membershipId ||
      entry.debtor_membership_id === membershipId;
    if (!involvesMe) continue;
    attention.push(
      formatOpeningBalanceAttention({
        entryId: entry.id,
        amountCents: entry.amount_cents,
        householdId,
      }),
    );
  }

  for (const proposal of routedRows.data ?? []) {
    const amount = proposal.amount_cents ?? 0;
    if (
      proposal.intermediary_membership_id === membershipId &&
      proposal.status === "awaiting_intermediary_approval"
    ) {
      attention.push(
        formatRoutedAttention({
          proposalId: proposal.id,
          kind: "intermediary",
          amountCents: amount,
          householdId,
        }),
      );
    } else if (
      proposal.recipient_membership_id === membershipId &&
      proposal.status === "awaiting_recipient_acceptance"
    ) {
      attention.push(
        formatRoutedAttention({
          proposalId: proposal.id,
          kind: "recipient",
          amountCents: amount,
          householdId,
        }),
      );
    } else if (
      proposal.payer_membership_id === membershipId &&
      proposal.status === "ready_to_pay"
    ) {
      attention.push(
        formatRoutedAttention({
          proposalId: proposal.id,
          kind: "ready_to_pay",
          amountCents: amount,
          householdId,
        }),
      );
    } else if (proposal.status === "stale") {
      const involved =
        proposal.payer_membership_id === membershipId ||
        proposal.intermediary_membership_id === membershipId ||
        proposal.recipient_membership_id === membershipId;
      if (involved) {
        attention.push(
          formatRoutedAttention({
            proposalId: proposal.id,
            kind: "stale",
            amountCents: amount,
            householdId,
          }),
        );
      }
    }
  }

  const receiptDraftCount = (receiptDrafts.data ?? []).length;
  if (receiptDraftCount > 0) {
    attention.push(
      formatReceiptDraftAttention({ count: receiptDraftCount, householdId }),
    );
  }

  for (const e of myDraftExpenses.data ?? []) {
    attention.push(
      formatExpenseDraftAttention({
        expenseId: e.id,
        merchant: e.merchant ?? "",
        householdId,
      }),
    );
  }

  for (const e of reviewExpenses.data ?? []) {
    attention.push(
      formatExpenseReviewAttention({
        expenseId: e.id,
        merchant: e.merchant ?? "",
        householdId,
      }),
    );
  }

  const activeMemberCount = members.length;
  const isSingleMember = activeMemberCount <= 1;

  const primaryActions = selectPrimaryActions({
    householdId,
    activeMemberCount,
    receiptsEnabled: launch.receipts,
    canCreateExpense: can(roles, "expense.create"),
    canCreatePayment: can(roles, "payment.create"),
    paymentConfirmCount: (awaitingConfirm.data ?? []).length,
    firstConfirmPaymentId: awaitingConfirm.data?.[0]?.id ?? null,
    officialYouOweCents: settlement.summary.officialYouOweCents,
    receiptDraftCount,
  });

  const unsettledIds = new Set(
    settlement.pairwise.map((p) => p.counterpartyMembershipId),
  );
  const pairwise: PairwiseHubRow[] = settlement.pairwise.map((p) => {
    const youOwe = Math.max(0, p.officialNetCents);
    const theyOwe = Math.max(0, -p.officialNetCents);
    return {
      counterpartyMembershipId: p.counterpartyMembershipId,
      displayName: nameOf(p.counterpartyMembershipId),
      officialNetCents: p.officialNetCents,
      pendingOutgoingCents: p.pendingOutgoingCents,
      pendingIncomingCents: p.pendingIncomingCents,
      youOweCents: youOwe,
      theyOweYouCents: theyOwe,
    };
  });
  const settledHiddenCount = isSingleMember
    ? 0
    : Math.max(0, activeMemberCount - 1 - unsettledIds.size);

  let routedSuggestionAvailable = false;
  if (!isSingleMember) {
    try {
      const edges = obligations
        .filter((o) => o.official_outstanding_cents > 0)
        .map((o) => ({
          obligationId: o.obligation_id,
          debtorMembershipId: o.debtor_membership_id,
          creditorMembershipId: o.creditor_membership_id,
          availableCents: o.official_outstanding_cents,
          currency: "USD",
        }));
      const suggestions = suggestRoutedSettlements(edges, { maxSuggestions: 3 });
      routedSuggestionAvailable = suggestions.some(
        (s) =>
          s.payerMembershipId === membershipId ||
          s.intermediaryMembershipId === membershipId ||
          s.recipientMembershipId === membershipId,
      );
    } catch {
      routedSuggestionAvailable = false;
    }
  }

  const expenseRows = expensesForMonth.data ?? [];
  const monthly = computeMonthlyFinancialSummary({
    householdId,
    membershipId,
    month,
    expenses: expenseRows.map((e) => ({
      id: e.id,
      merchant: e.merchant ?? "",
      category: e.category,
      purchase_date: e.purchase_date,
      declared_total_cents: e.declared_total_cents,
      status: e.status,
    })),
    payments: (paymentsForMonth.data ?? []).map((p) => ({
      id: p.id,
      total_amount_cents: p.total_amount_cents,
      status: p.status,
      submitted_at: p.submitted_at,
      confirmed_at: p.confirmed_at,
    })),
    utilities: (utilities.data ?? []).map((u) => ({
      estimated_amount_cents: u.estimated_amount_cents,
      actual_amount_cents: u.actual_amount_cents,
    })),
    disputedObligationCents: 0,
    priorMonthExpenses: expenseRows.map((e) => ({
      id: e.id,
      merchant: e.merchant ?? "",
      category: e.category,
      purchase_date: e.purchase_date,
      declared_total_cents: e.declared_total_cents,
      status: e.status,
    })),
  });

  const activity = buildActivityFeed({
    householdId,
    nameOf,
    expenses: recentExpenses.data ?? [],
    payments: recentPayments.data ?? [],
    disputes: recentDisputes.data ?? [],
    routed: recentRouted.data ?? [],
  });

  const tools = buildTools({
    householdId,
    isSingleMember,
    receiptsEnabled: launch.receipts,
  });

  void userId;

  return {
    version: MONEY_OVERVIEW_VERSION,
    householdId,
    membershipId,
    fetchedAt: new Date().toISOString(),
    activeMemberCount,
    isSingleMember,
    balance: settlement.summary,
    primaryActions,
    attention: sortAttentionItems(attention).slice(0, 20),
    pairwise: isSingleMember ? [] : pairwise,
    settledHiddenCount,
    routedSuggestionAvailable: !isSingleMember && routedSuggestionAvailable,
    monthly,
    activity,
    tools,
    canInvite: can(roles, "member.invite"),
  };
}

function buildActivityFeed(params: {
  householdId: string;
  nameOf: (id: string) => string;
  expenses: Array<{
    id: string;
    merchant: string | null;
    declared_total_cents: number;
    status: string;
    purchase_date: string;
    confirmed_at: string | null;
    created_at: string;
    updated_at: string;
    category: string | null;
  }>;
  payments: Array<{
    id: string;
    total_amount_cents: number;
    status: string;
    submitted_at: string | null;
    confirmed_at: string | null;
    created_at: string;
    sender_membership_id: string;
    recipient_membership_id: string;
  }>;
  disputes: Array<{
    id: string;
    status: string;
    created_at: string;
    resolved_at: string | null;
  }>;
  routed: Array<{
    id: string;
    status: string;
    amount_cents: number | null;
    created_at: string;
    updated_at: string;
  }>;
}): ActivityItem[] {
  const items: ActivityItem[] = [];
  const base = `/app/${params.householdId}/money`;

  for (const e of params.expenses) {
    const kind =
      e.status === "confirmed"
        ? "expense_confirmed"
        : e.status === "amended"
          ? "expense_amended"
          : e.category === "utilities"
            ? "utility_recorded"
            : "expense_created";
    items.push({
      id: `expense-${e.id}`,
      kind,
      description: formatActivityDescription(kind, { merchant: e.merchant }),
      amountCents: e.declared_total_cents,
      secondary: e.merchant,
      date: e.purchase_date,
      statusLabel: activityStatusLabel(kind, e.status),
      href: `${base}/expenses/${e.id}`,
      sortAt: e.updated_at || e.created_at,
    });
  }

  for (const p of params.payments) {
    const kind =
      p.status === "confirmed"
        ? "payment_confirmed"
        : p.status === "reversed"
          ? "payment_reversed"
          : "payment_submitted";
    const other =
      p.status === "confirmed"
        ? params.nameOf(p.sender_membership_id)
        : params.nameOf(p.recipient_membership_id);
    items.push({
      id: `payment-${p.id}`,
      kind,
      description: formatActivityDescription(kind, { member: other }),
      amountCents: p.total_amount_cents,
      secondary: other,
      date: (p.confirmed_at || p.submitted_at || p.created_at).slice(0, 10),
      statusLabel: activityStatusLabel(kind, p.status),
      href: `${base}/payments/${p.id}`,
      sortAt: p.confirmed_at || p.submitted_at || p.created_at,
    });
  }

  for (const d of params.disputes) {
    const kind =
      d.status === "resolved" || d.status === "withdrawn"
        ? "dispute_resolved"
        : "dispute_opened";
    items.push({
      id: `dispute-${d.id}`,
      kind,
      description: formatActivityDescription(kind),
      amountCents: null,
      secondary: null,
      date: (d.resolved_at || d.created_at).slice(0, 10),
      statusLabel: activityStatusLabel(kind, d.status),
      href: `${base}/disputes/${d.id}`,
      sortAt: d.resolved_at || d.created_at,
    });
  }

  for (const r of params.routed) {
    const kind =
      r.status === "confirmed" ? "routed_confirmed" : "routed_proposed";
    items.push({
      id: `routed-${r.id}`,
      kind,
      description: formatActivityDescription(kind),
      amountCents: r.amount_cents,
      secondary: null,
      date: (r.updated_at || r.created_at).slice(0, 10),
      statusLabel: activityStatusLabel(kind, r.status),
      href: `${base}/simplify/${r.id}`,
      sortAt: r.updated_at || r.created_at,
    });
  }

  return sortActivity(items).slice(0, 15);
}

function buildTools(params: {
  householdId: string;
  isSingleMember: boolean;
  receiptsEnabled: boolean;
}): MoneyToolsGroups {
  const base = `/app/${params.householdId}/money`;
  const records = [
    { label: "All expenses", href: `${base}/expenses`, testId: "tool-expenses" },
    { label: "Payments", href: `${base}/payments`, testId: "tool-payments" },
    {
      label: "Reimbursements",
      href: `${base}/reimbursements`,
      testId: "tool-reimbursements",
    },
    { label: "Ledger", href: `${base}/ledger`, testId: "tool-ledger" },
  ];
  const balanceTools = [
    { label: "Balances", href: `${base}/balances`, testId: "tool-balances" },
    ...(params.isSingleMember
      ? []
      : [
          {
            label: "Simplify balances",
            href: `${base}/simplify`,
            testId: "tool-simplify",
          },
        ]),
    {
      label: "Opening balances",
      href: `${base}/opening-balances`,
      testId: "tool-opening",
    },
    { label: "Disputes", href: `${base}/disputes`, testId: "tool-disputes" },
  ];
  const receiptsReporting = [
    ...(params.receiptsEnabled
      ? [
          {
            label: "Receipt drafts",
            href: `${base}/receipts`,
            testId: "tool-receipts",
          },
        ]
      : []),
    {
      label: "Import data",
      href: `/app/${params.householdId}/settings/import`,
      testId: "tool-import",
    },
  ];
  const settings = [
    {
      label: "Recurring bills",
      href: `/app/${params.householdId}/utilities`,
      testId: "tool-utilities",
    },
    {
      label: "Household settings",
      href: `/app/${params.householdId}/settings`,
      testId: "tool-settings",
    },
  ];
  return { records, balanceTools, receiptsReporting, settings };
}

/** Re-export types used by hub components. */
export type { PairwiseBalance, MemberBalanceSummary };
