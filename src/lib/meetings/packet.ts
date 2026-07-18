import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  computeMonthlyFinancialSummary,
  type MonthlyFinancialSummary,
} from "@/lib/money/monthly-summary";
import { getSettlementBalancesForMembership } from "@/lib/payments/queries";
import {
  AGENDA_RULES_VERSION,
  DEFAULT_AGENDA_RULE_CONFIG,
  suggestAgendaItems,
  type SuggestedAgendaItem,
} from "@/lib/meetings/agenda-rules";
import { comparisonPeriod, type ReviewPeriod } from "@/lib/meetings/period";
import { forecastSupplyRestock } from "@/lib/ops/supply-forecast";
import { meetingTable } from "@/lib/meetings/client";

export const MEETING_PACKET_VERSION = 1;

export type SharedMeetingPacket = {
  version: typeof MEETING_PACKET_VERSION;
  agendaRulesVersion: typeof AGENDA_RULES_VERSION;
  period: ReviewPeriod;
  comparison: { start: string; end: string };
  money: {
    summary: MonthlyFinancialSummary;
    unsettledPairCount: number;
    sharePairwise: boolean;
  };
  chores: { completed: number; open: number; overdue: number };
  maintenance: { open: number; highSeverity: number };
  utilities: { dueSoon: number; missingActual: number };
  calendar: { upcomingEvents: number; guestNotices: number; busyOnlyAbsences: number };
  food: { openShopping: number; supplyWarnings: string[] };
  purchases: { openProposals: number };
  governance: { pendingApprovals: number };
  packagesParking: { unclaimedPackages: number };
  warnings: string[];
  suggestedAgenda: SuggestedAgendaItem[];
  fetchedAt: string;
};

export type PersonalMeetingAddendum = {
  version: typeof MEETING_PACKET_VERSION;
  membershipId: string;
  youOweCents: number;
  youAreOwedCents: number;
  pendingConfirmations: number;
  receiptDrafts: number;
  privateFollowUps: string[];
  fetchedAt: string;
};

/** JSON-safe shared packet for lock/publish (strips function deep-link builders). */
export function serializeSharedPacketForLock(
  packet: SharedMeetingPacket,
): Record<string, unknown> {
  const { summary, ...moneyRest } = packet.money;
  const { deepLinks, ...summaryRest } = summary;
  return {
    ...packet,
    money: {
      ...moneyRest,
      summary: {
        ...summaryRest,
        deepLinks: {
          sharedPurchases: deepLinks.sharedPurchases,
          pendingExpenses: deepLinks.pendingExpenses,
          pendingPayments: deepLinks.pendingPayments,
          disputed: deepLinks.disputed,
          categoryTemplate: deepLinks.category("{category}"),
        },
      },
    },
  };
}

export async function buildSharedMeetingPacket(params: {
  householdId: string;
  membershipId: string;
  period: ReviewPeriod;
  sharePairwiseBalances?: boolean;
}): Promise<SharedMeetingPacket> {
  const supabase = await createClient();
  const { householdId, membershipId, period } = params;
  const comparison = comparisonPeriod(period);
  const warnings: string[] = [];
  const priorActionsTable = await meetingTable("household_meeting_action_items");

  const [
    expenses,
    payments,
    utilities,
    choreDone,
    choreOpen,
    choreOverdue,
    maintOpen,
    maintHigh,
    guests,
    events,
    shopping,
    supplies,
    purchases,
    polls,
    disputes,
    routed,
    priorActions,
    packages,
  ] = await Promise.all([
    supabase
      .from("expenses")
      .select("id, merchant, category, purchase_date, declared_total_cents, status")
      .eq("household_id", householdId)
      .gte("purchase_date", comparison.start)
      .lte("purchase_date", period.end)
      .limit(300),
    supabase
      .from("payments")
      .select("id, total_amount_cents, status, submitted_at, confirmed_at")
      .eq("household_id", householdId)
      .limit(150),
    supabase
      .from("household_utilities")
      .select("id, name, estimated_amount_cents, actual_amount_cents, due_day_of_month")
      .eq("household_id", householdId)
      .limit(40),
    supabase
      .from("chore_occurrences")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .in("status", ["completed", "verified"])
      .gte("due_at", `${period.start}T00:00:00Z`)
      .lte("due_at", `${period.end}T23:59:59Z`),
    supabase
      .from("chore_occurrences")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .in("status", ["pending", "claimed", "in_progress"])
      .gte("due_at", `${period.start}T00:00:00Z`)
      .lte("due_at", `${period.end}T23:59:59Z`),
    supabase
      .from("chore_occurrences")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .eq("status", "overdue"),
    supabase
      .from("maintenance_requests")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .not("status", "in", '("resolved","closed","cancelled")'),
    supabase
      .from("maintenance_requests")
      .select("id, title, severity, status, created_at, updated_at")
      .eq("household_id", householdId)
      .in("severity", ["high", "urgent"])
      .not("status", "in", '("resolved","closed","cancelled")')
      .limit(20),
    supabase
      .from("guest_notices")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .gte("starts_at", new Date().toISOString()),
    supabase
      .from("calendar_events")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .gte("starts_at", new Date().toISOString())
      .limit(1),
    supabase
      .from("shopping_list_items")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .in("status", ["requested", "approved", "assigned", "in_cart"]),
    supabase
      .from("supply_items")
      .select("id, name, quantity, reorder_threshold")
      .eq("household_id", householdId)
      .limit(40),
    supabase
      .from("shared_purchase_proposals")
      .select("id, title, status, created_at")
      .eq("household_id", householdId)
      .eq("status", "proposed")
      .limit(20),
    supabase
      .from("household_polls")
      .select("id, question, status")
      .eq("household_id", householdId)
      .eq("status", "open")
      .limit(20),
    supabase
      .from("reimbursement_disputes")
      .select("id, status")
      .eq("household_id", householdId)
      .in("status", ["open", "under_review"])
      .limit(20),
    supabase
      .from("routed_settlement_proposals")
      .select("id, amount_cents, status")
      .eq("household_id", householdId)
      .in("status", [
        "awaiting_intermediary_approval",
        "awaiting_recipient_acceptance",
        "ready_to_pay",
      ])
      .limit(20),
    priorActionsTable
      .select("id, title, status, due_date")
      .eq("household_id", householdId)
      .in("status", ["open", "overdue", "needs_reassignment"])
      .limit(40),
    supabase
      .from("household_packages")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .eq("status", "arrived"),
  ]);

  const monthKey = period.start.slice(0, 7);
  const summary = computeMonthlyFinancialSummary({
    householdId,
    membershipId,
    month: monthKey,
    expenses: (expenses.data ?? []).map((e) => ({
      id: e.id,
      merchant: e.merchant ?? "",
      category: e.category,
      purchase_date: e.purchase_date,
      declared_total_cents: e.declared_total_cents,
      status: e.status,
    })),
    payments: (payments.data ?? []).map((p) => ({
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
  });

  const missingActual = (utilities.data ?? []).filter(
    (u) => u.actual_amount_cents == null,
  ).length;
  if (missingActual > 0) {
    warnings.push(
      `${missingActual} utility bill${missingActual === 1 ? "" : "s"} do not have actual amounts recorded.`,
    );
  }

  const settlement = await getSettlementBalancesForMembership(
    householdId,
    membershipId,
  );
  const unsettledPairCount = settlement.pairwise.filter(
    (p) => p.officialNetCents !== 0,
  ).length;

  const forecast = forecastSupplyRestock(
    (supplies.data ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      quantity: s.quantity,
      reorderThreshold: s.reorder_threshold,
    })),
  );
  const supplyWarnings = forecast.map(
    (f) => `${f.name} is at or below its reorder threshold.`,
  );

  const today = new Date().toISOString().slice(0, 10);
  const suggestedAgenda = suggestAgendaItems(
    {
      openDisputes: (disputes.data ?? []).map((d) => ({ id: d.id })),
      sharedPurchases: (purchases.data ?? []).map((p) => ({
        id: p.id,
        title: p.title,
        deadline: null,
      })),
      openPolls: (polls.data ?? []).map((p) => ({
        id: p.id,
        title: p.question ?? "Open poll",
      })),
      pendingGovernance: [],
      unownedResponsibilities: [],
      supplyRunouts: forecast.map((f) => ({
        id: f.id,
        name: f.name,
        daysUntil: null,
      })),
      maintenanceWaiting: (maintHigh.data ?? []).map((m) => ({
        id: m.id,
        title: m.title,
        severity: m.severity,
        waitingDays: Math.max(
          0,
          Math.floor(
            (Date.now() - Date.parse(m.updated_at || m.created_at)) / 86400000,
          ),
        ),
      })),
      choreMissPatterns: [],
      utilityVariances: (utilities.data ?? [])
        .filter(
          (u) =>
            u.estimated_amount_cents != null &&
            u.actual_amount_cents != null &&
            u.estimated_amount_cents > 0,
        )
        .map((u) => ({
          id: u.id,
          name: u.name,
          estimateCents: u.estimated_amount_cents ?? 0,
          actualCents: u.actual_amount_cents ?? 0,
        })),
      openPriorActions: (
        (priorActions.data ?? []) as Array<{ id: string; title: string }>
      ).map((a) => ({
        id: a.id,
        title: a.title,
      })),
      routedProposals: (routed.data ?? []).map((r) => ({
        id: r.id,
        amountCents: r.amount_cents,
      })),
      today,
    },
    DEFAULT_AGENDA_RULE_CONFIG,
  );

  return {
    version: MEETING_PACKET_VERSION,
    agendaRulesVersion: AGENDA_RULES_VERSION,
    period,
    comparison,
    money: {
      summary,
      unsettledPairCount,
      sharePairwise: params.sharePairwiseBalances ?? false,
    },
    chores: {
      completed: choreDone.count ?? 0,
      open: choreOpen.count ?? 0,
      overdue: choreOverdue.count ?? 0,
    },
    maintenance: {
      open: maintOpen.count ?? 0,
      highSeverity: (maintHigh.data ?? []).length,
    },
    utilities: {
      dueSoon: (utilities.data ?? []).length,
      missingActual,
    },
    calendar: {
      upcomingEvents: events.count ?? 0,
      guestNotices: guests.count ?? 0,
      busyOnlyAbsences: 0,
    },
    food: {
      openShopping: shopping.count ?? 0,
      supplyWarnings,
    },
    purchases: { openProposals: (purchases.data ?? []).length },
    governance: { pendingApprovals: 0 },
    packagesParking: { unclaimedPackages: packages.count ?? 0 },
    warnings,
    suggestedAgenda,
    fetchedAt: new Date().toISOString(),
  };
}

export async function buildPersonalMeetingAddendum(params: {
  householdId: string;
  membershipId: string;
}): Promise<PersonalMeetingAddendum> {
  const supabase = await createClient();
  const settlement = await getSettlementBalancesForMembership(
    params.householdId,
    params.membershipId,
  );
  const [{ count: pendingConfirmations }, { count: receiptDrafts }] =
    await Promise.all([
      supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("household_id", params.householdId)
        .eq("recipient_membership_id", params.membershipId)
        .eq("status", "submitted"),
      supabase
        .from("expense_receipts")
        .select("id", { count: "exact", head: true })
        .eq("household_id", params.householdId)
        .eq("uploaded_by_membership_id", params.membershipId)
        .in("status", ["uploaded", "extracting", "needs_review"])
        .is("deleted_at", null),
    ]);

  return {
    version: MEETING_PACKET_VERSION,
    membershipId: params.membershipId,
    youOweCents: settlement.summary.officialYouOweCents,
    youAreOwedCents: settlement.summary.officialYouAreOwedCents,
    pendingConfirmations: pendingConfirmations ?? 0,
    receiptDrafts: receiptDrafts ?? 0,
    privateFollowUps: [],
    fetchedAt: new Date().toISOString(),
  };
}
