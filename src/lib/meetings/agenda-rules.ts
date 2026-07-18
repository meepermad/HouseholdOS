/** Deterministic suggested-agenda rules (versioned). */

export const AGENDA_RULES_VERSION = "1";

export type AgendaRuleConfig = {
  purchaseDeadlineDays: number;
  maintenanceWaitDays: number;
  utilityVariancePct: number;
  choreMissThreshold: number;
};

export const DEFAULT_AGENDA_RULE_CONFIG: AgendaRuleConfig = {
  purchaseDeadlineDays: 14,
  maintenanceWaitDays: 14,
  utilityVariancePct: 15,
  choreMissThreshold: 3,
};

export type SuggestedAgendaInput = {
  openDisputes: { id: string; title?: string }[];
  sharedPurchases: { id: string; title: string; deadline?: string | null }[];
  openPolls: { id: string; title: string }[];
  pendingGovernance: { id: string; title: string }[];
  unownedResponsibilities: { id: string; title: string }[];
  supplyRunouts: { id: string; name: string; daysUntil?: number | null }[];
  maintenanceWaiting: {
    id: string;
    title: string;
    severity: string;
    waitingDays: number;
  }[];
  choreMissPatterns: { id: string; title: string; missCount: number }[];
  utilityVariances: {
    id: string;
    name: string;
    estimateCents: number;
    actualCents: number;
  }[];
  openPriorActions: { id: string; title: string }[];
  routedProposals: { id: string; amountCents: number }[];
  today: string;
};

export type SuggestedAgendaItem = {
  sectionKey: string;
  title: string;
  whyIncluded: string;
  sourceEntityType: string;
  sourceEntityId: string;
  deadline?: string | null;
  mayDecideInMeeting: boolean;
};

function daysUntil(deadline: string, today: string): number {
  const a = Date.parse(`${today}T00:00:00Z`);
  const b = Date.parse(`${deadline}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function suggestAgendaItems(
  input: SuggestedAgendaInput,
  config: AgendaRuleConfig = DEFAULT_AGENDA_RULE_CONFIG,
): SuggestedAgendaItem[] {
  const out: SuggestedAgendaItem[] = [];

  for (const d of input.openDisputes) {
    out.push({
      sectionKey: "money",
      title: "Unresolved expense dispute",
      whyIncluded: "Include an expense dispute when still open.",
      sourceEntityType: "reimbursement_dispute",
      sourceEntityId: d.id,
      mayDecideInMeeting: true,
    });
  }

  for (const p of input.sharedPurchases) {
    if (
      p.deadline &&
      daysUntil(p.deadline, input.today) <= config.purchaseDeadlineDays
    ) {
      out.push({
        sectionKey: "purchases",
        title: p.title,
        whyIncluded: `Include a shared purchase when approval deadline is within ${config.purchaseDeadlineDays} days.`,
        sourceEntityType: "shared_purchase_proposal",
        sourceEntityId: p.id,
        deadline: p.deadline,
        mayDecideInMeeting: true,
      });
    }
  }

  for (const poll of input.openPolls) {
    out.push({
      sectionKey: "decisions",
      title: poll.title,
      whyIncluded: "Include a poll without a clear result.",
      sourceEntityType: "poll",
      sourceEntityId: poll.id,
      mayDecideInMeeting: true,
    });
  }

  for (const g of input.pendingGovernance) {
    out.push({
      sectionKey: "governance",
      title: g.title,
      whyIncluded: "Include a governance approval still pending.",
      sourceEntityType: "governance_document",
      sourceEntityId: g.id,
      mayDecideInMeeting: false,
    });
  }

  for (const r of input.unownedResponsibilities) {
    out.push({
      sectionKey: "chores",
      title: r.title,
      whyIncluded: "Include a responsibility area when it has no active owner.",
      sourceEntityType: "responsibility",
      sourceEntityId: r.id,
      mayDecideInMeeting: true,
    });
  }

  for (const s of input.supplyRunouts) {
    out.push({
      sectionKey: "food",
      title: `${s.name} may run out soon`,
      whyIncluded:
        "Include a supply when projected runout is before the next shopping trip.",
      sourceEntityType: "supply_item",
      sourceEntityId: s.id,
      mayDecideInMeeting: true,
    });
  }

  for (const m of input.maintenanceWaiting) {
    if (
      m.severity === "high" ||
      m.severity === "urgent" ||
      m.waitingDays >= config.maintenanceWaitDays
    ) {
      out.push({
        sectionKey: "maintenance",
        title: m.title,
        whyIncluded: `Include maintenance when high severity or waiting longer than ${config.maintenanceWaitDays} days.`,
        sourceEntityType: "maintenance_request",
        sourceEntityId: m.id,
        mayDecideInMeeting: true,
      });
    }
  }

  for (const c of input.choreMissPatterns) {
    if (c.missCount >= config.choreMissThreshold) {
      out.push({
        sectionKey: "chores",
        title: c.title,
        whyIncluded:
          "Include a chore pattern when the same recurring chore was missed repeatedly.",
        sourceEntityType: "chore",
        sourceEntityId: c.id,
        mayDecideInMeeting: true,
      });
    }
  }

  for (const u of input.utilityVariances) {
    if (u.estimateCents <= 0) continue;
    const pct =
      (Math.abs(u.actualCents - u.estimateCents) / u.estimateCents) * 100;
    if (pct >= config.utilityVariancePct) {
      out.push({
        sectionKey: "utilities",
        title: `${u.name} amount changed`,
        whyIncluded:
          "Include a utility when actual amount differs materially from its estimate.",
        sourceEntityType: "household_utility",
        sourceEntityId: u.id,
        mayDecideInMeeting: true,
      });
    }
  }

  for (const a of input.openPriorActions) {
    out.push({
      sectionKey: "follow_up",
      title: a.title,
      whyIncluded: "Include a prior action item when still open.",
      sourceEntityType: "meeting_action_item",
      sourceEntityId: a.id,
      mayDecideInMeeting: true,
    });
  }

  for (const r of input.routedProposals) {
    out.push({
      sectionKey: "money",
      title: "Routed settlement awaiting consent",
      whyIncluded:
        "Include a routed-settlement proposal involving meeting participants.",
      sourceEntityType: "routed_settlement_proposal",
      sourceEntityId: r.id,
      mayDecideInMeeting: true,
    });
  }

  return out.sort((a, b) =>
    a.sectionKey.localeCompare(b.sectionKey) ||
    a.title.localeCompare(b.title) ||
    a.sourceEntityId.localeCompare(b.sourceEntityId),
  );
}

export function groupFollowUpActions(
  items: readonly {
    id: string;
    title: string;
    status: string;
    dueDate?: string | null;
    completedAt?: string | null;
  }[],
  today: string,
): Record<
  "completed" | "still_open" | "overdue" | "cancelled" | "needs_reassignment",
  typeof items
> {
  const groups = {
    completed: [] as typeof items,
    still_open: [] as typeof items,
    overdue: [] as typeof items,
    cancelled: [] as typeof items,
    needs_reassignment: [] as typeof items,
  };
  for (const item of items) {
    if (item.status === "completed") groups.completed = [...groups.completed, item];
    else if (item.status === "cancelled")
      groups.cancelled = [...groups.cancelled, item];
    else if (item.status === "needs_reassignment")
      groups.needs_reassignment = [...groups.needs_reassignment, item];
    else if (
      item.status === "overdue" ||
      (item.status === "open" && item.dueDate && item.dueDate < today)
    )
      groups.overdue = [...groups.overdue, item];
    else groups.still_open = [...groups.still_open, item];
  }
  return groups;
}
