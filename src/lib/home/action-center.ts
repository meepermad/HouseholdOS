import "server-only";
import { listActionCenterItems } from "@/lib/payments/queries";
import { getSettlementBalancesForMembership } from "@/lib/payments/queries";
import { listChoreActionCenterItems } from "@/lib/chores/queries";
import { listOccurrencesInRange } from "@/lib/calendar/queries";
import {
  listOpenApprovalRequests,
  listPendingAcknowledgments,
} from "@/lib/governance/queries";
import { listMaintenanceRequests } from "@/lib/maintenance/queries";
import { QUICK_ADD_ACTIONS } from "@/lib/nav-items";
import { householdRoutes } from "@/lib/routes/household";

export type HomeAttentionItem = {
  id: string;
  title: string;
  detail: string;
  urgency: "high" | "normal";
  href: string;
};

export type HomeTodayItem = {
  id: string;
  label: string;
  href: string;
};

export type HomeMoneySummary = {
  youOweCents: number;
  youAreOwedCents: number;
  awaitingConfirmation: number;
};

export type HomeActionCenterData = {
  attention: HomeAttentionItem[];
  today: HomeTodayItem[];
  money: HomeMoneySummary;
  houseExceptions: HomeTodayItem[];
  upcoming: HomeTodayItem[];
  quickActions: { key: string; label: string; href: string }[];
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function prioritizeAttention(items: HomeAttentionItem[]): HomeAttentionItem[] {
  const rank = { high: 0, normal: 1 };
  return [...items].sort((a, b) => rank[a.urgency] - rank[b.urgency]);
}

export async function loadHomeActionCenter(options: {
  householdId: string;
  membershipId: string;
  userId: string;
}): Promise<HomeActionCenterData> {
  const { householdId, membershipId, userId } = options;
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = new Date(todayEnd);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const attention: HomeAttentionItem[] = [];
  const today: HomeTodayItem[] = [];
  const houseExceptions: HomeTodayItem[] = [];
  const upcoming: HomeTodayItem[] = [];

  const money: HomeMoneySummary = {
    youOweCents: 0,
    youAreOwedCents: 0,
    awaitingConfirmation: 0,
  };

  try {
    const moneyItems = await listActionCenterItems(
      householdId,
      membershipId,
      userId,
    );
    for (const p of moneyItems.awaitingConfirm) {
      attention.push({
        id: `pay-${p.id}`,
        title: "Confirm a payment",
        detail: "Someone marked a payment as sent. Confirm when you receive it.",
        urgency: "high",
        href: householdRoutes.money.payments(householdId, p.id),
      });
    }
    for (const d of moneyItems.openDisputes) {
      attention.push({
        id: `dispute-${d.id}`,
        title: "Review a money dispute",
        detail: "An open dispute needs your attention.",
        urgency: "high",
        href: householdRoutes.money.disputes(householdId, d.id),
      });
    }
    for (const r of moneyItems.refundsOwed) {
      if (!r.obligation_id) continue;
      attention.push({
        id: `refund-${r.obligation_id}`,
        title: "Refund owed",
        detail: "You have an open refund obligation.",
        urgency: "normal",
        href: householdRoutes.money.reimbursements(
          householdId,
          r.obligation_id,
        ),
      });
    }
    money.awaitingConfirmation = moneyItems.awaitingConfirm.length;
  } catch {
    /* degrade */
  }

  try {
    const balances = await getSettlementBalancesForMembership(
      householdId,
      membershipId,
    );
    money.youOweCents = balances.summary.officialYouOweCents;
    money.youAreOwedCents = balances.summary.officialYouAreOwedCents;
  } catch {
    /* degrade */
  }

  try {
    const choreItems = await listChoreActionCenterItems(
      householdId,
      membershipId,
    );
    for (const item of choreItems.overdue) {
      attention.push({
        id: `chore-overdue-${item.id}`,
        title: "Overdue chore",
        detail: item.title ?? "A chore is past due.",
        urgency: "high",
        href: householdRoutes.chores.index(householdId),
      });
    }
    for (const item of choreItems.dueSoon) {
      today.push({
        id: `chore-due-${item.id}`,
        label: item.title ?? "Chore due",
        href: householdRoutes.chores.index(householdId),
      });
      attention.push({
        id: `chore-attn-${item.id}`,
        title: "Chore due soon",
        detail: item.title ?? "Complete or reassign this chore.",
        urgency: "normal",
        href: householdRoutes.chores.index(householdId),
      });
    }
    for (const item of choreItems.awaitingVerification) {
      attention.push({
        id: `chore-verify-${item.id}`,
        title: "Verify a chore",
        detail: item.title ?? "Confirm that this chore was done.",
        urgency: "normal",
        href: householdRoutes.chores.index(householdId),
      });
    }
    for (const item of choreItems.reassignmentPending) {
      attention.push({
        id: `chore-reassign-${item.id}`,
        title: "Respond to chore reassignment",
        detail: item.title ?? "A reassignment request is waiting.",
        urgency: "normal",
        href: householdRoutes.chores.index(householdId),
      });
    }
    for (const item of choreItems.responsibilityTransferPending) {
      attention.push({
        id: `resp-${item.id}`,
        title: "Responsibility transfer",
        detail: "Accept or decline a responsibility handoff.",
        urgency: "normal",
        href: householdRoutes.responsibilities(householdId),
      });
    }
  } catch {
    /* degrade */
  }

  try {
    const events = await listOccurrencesInRange(
      householdId,
      membershipId,
      todayStart.toISOString(),
      todayEnd.toISOString(),
    );
    for (const occ of events.slice(0, 8)) {
      today.push({
        id: `evt-${occ.occurrenceId}`,
        label: occ.title,
        href: householdRoutes.calendar.event(householdId, occ.eventId),
      });
    }

    const upcomingEvents = await listOccurrencesInRange(
      householdId,
      membershipId,
      todayEnd.toISOString(),
      weekEnd.toISOString(),
    );
    for (const occ of upcomingEvents.slice(0, 5)) {
      upcoming.push({
        id: `up-${occ.occurrenceId}`,
        label: occ.title,
        href: householdRoutes.calendar.event(householdId, occ.eventId),
      });
    }
  } catch {
    /* degrade */
  }

  try {
    const approvals = await listOpenApprovalRequests(householdId);
    for (const a of approvals.slice(0, 5)) {
      attention.push({
        id: `gov-appr-${a.id}`,
        title: "Governance approval needed",
        detail: "A household document is waiting for approval.",
        urgency: "normal",
        href: householdRoutes.governance.approvals(householdId),
      });
    }
    const acks = await listPendingAcknowledgments(householdId, membershipId);
    for (const a of acks.slice(0, 5)) {
      attention.push({
        id: `gov-ack-${a.id}`,
        title: "Acknowledgment needed",
        detail: "Confirm that you have read a household document.",
        urgency: "normal",
        href: householdRoutes.governance.acknowledgments(householdId),
      });
    }
  } catch {
    /* degrade */
  }

  try {
    const maintenance = await listMaintenanceRequests(householdId);
    const open = (maintenance ?? []).filter((r) =>
      [
        "reported",
        "triaged",
        "assigned",
        "in_progress",
        "reopened",
        "waiting_on_household",
      ].includes(r.status),
    );
    for (const r of open.slice(0, 3)) {
      if (r.severity === "urgent" || r.severity === "emergency_guidance") {
        attention.push({
          id: `maint-${r.id}`,
          title: "Urgent maintenance update",
          detail: r.title,
          urgency: "high",
          href: householdRoutes.maintenance.detail(householdId, r.id),
        });
      } else {
        houseExceptions.push({
          id: `maint-ex-${r.id}`,
          label: r.title,
          href: householdRoutes.maintenance.detail(householdId, r.id),
        });
      }
    }
  } catch {
    /* degrade */
  }

  try {
    const { meetingTable } = await import("@/lib/meetings/client");
    const meetingsT = await meetingTable("household_meetings");
    const { data: nextMeeting } = await meetingsT
      .select("id, title, meeting_at, status")
      .eq("household_id", householdId)
      .in("status", [
        "draft",
        "preparing",
        "ready_for_review",
        "locked",
        "in_progress",
      ])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (nextMeeting?.id) {
      attention.push({
        id: `meeting-${nextMeeting.id}`,
        title: "Monthly household meeting",
        detail: nextMeeting.meeting_at
          ? `Scheduled ${String(nextMeeting.meeting_at)}. Agenda items need review.`
          : "Prepare the monthly review packet before the meeting.",
        urgency: "normal",
        href: householdRoutes.meetings.detail(householdId, String(nextMeeting.id)),
      });
    }
  } catch {
    /* degrade when meetings schema not yet applied */
  }

  return {
    attention: prioritizeAttention(attention).slice(0, 12),
    today: today.slice(0, 10),
    money,
    houseExceptions: houseExceptions.slice(0, 6),
    upcoming: upcoming.slice(0, 5),
    quickActions: QUICK_ADD_ACTIONS.map((a) => ({
      key: a.key,
      label: a.label,
      href: a.href(householdId),
    })),
  };
}

export { prioritizeAttention };
