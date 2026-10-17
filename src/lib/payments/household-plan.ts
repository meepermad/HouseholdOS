/**
 * One household settlement plan from each person's net.
 * Covered loops are removed first (nobody pays them). What's left is matched
 * largest debt to largest reachable credit, and each payment names the
 * obligation legs that payment reduces.
 */
import type { DirectedObligationEdge } from "@/lib/payments/routed-suggestions";
import { PaymentCalcError } from "@/lib/payments/types";

export type HouseholdLeg = {
  obligationId: string;
  debtorMembershipId: string;
  creditorMembershipId: string;
  amountCents: number;
};

export type HouseholdOffset = {
  amountCents: number;
  currency: string;
  /** People around the covered loop, in cycle order. */
  membershipIds: string[];
  legs: HouseholdLeg[];
};

export type HouseholdPayment = {
  payerMembershipId: string;
  recipientMembershipId: string;
  amountCents: number;
  currency: string;
  legs: HouseholdLeg[];
};

export type HouseholdSettlementPlan = {
  offsets: HouseholdOffset[];
  payments: HouseholdPayment[];
};

type ResidualEdge = DirectedObligationEdge & { remainingCents: number };

const MAX_STEPS = 500;

function assertCents(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new PaymentCalcError(
      "unsafe_integer",
      `${label} must be a non-negative integer`,
    );
  }
}

function outgoing(edges: readonly ResidualEdge[], debtorId: string): ResidualEdge[] {
  return edges
    .filter(
      (edge) =>
        edge.debtorMembershipId === debtorId && edge.remainingCents > 0,
    )
    .sort((a, b) => a.obligationId.localeCompare(b.obligationId));
}

function findCycle(edges: readonly ResidualEdge[]): ResidualEdge[] | null {
  const nodes = [
    ...new Set(
      edges
        .filter((edge) => edge.remainingCents > 0)
        .flatMap((edge) => [
          edge.debtorMembershipId,
          edge.creditorMembershipId,
        ]),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const visited = new Set<string>();

  function dfs(
    node: string,
    stackEdges: ResidualEdge[],
    onStack: Set<string>,
  ): ResidualEdge[] | null {
    visited.add(node);
    onStack.add(node);
    for (const edge of outgoing(edges, node)) {
      const next = edge.creditorMembershipId;
      if (onStack.has(next)) {
        const cycle = [...stackEdges, edge];
        const start = cycle.findIndex(
          (step) => step.debtorMembershipId === next,
        );
        return start >= 0 ? cycle.slice(start) : cycle;
      }
      if (!visited.has(next)) {
        const found = dfs(next, [...stackEdges, edge], onStack);
        if (found) return found;
      }
    }
    onStack.delete(node);
    return null;
  }

  for (const node of nodes) {
    if (visited.has(node)) continue;
    const found = dfs(node, [], new Set());
    if (found && found.length >= 2) return found;
  }
  return null;
}

function shortestPath(
  edges: readonly ResidualEdge[],
  from: string,
  to: string,
): ResidualEdge[] | null {
  const queue: { node: string; path: ResidualEdge[] }[] = [
    { node: from, path: [] },
  ];
  const seen = new Set<string>([from]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    for (const edge of outgoing(edges, current.node)) {
      const next = edge.creditorMembershipId;
      const path = [...current.path, edge];
      if (next === to) return path;
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push({ node: next, path });
    }
  }
  return null;
}

function maxFlow(edges: readonly ResidualEdge[], from: string, to: string): number {
  const copy = edges.map((edge) => ({ ...edge }));
  let total = 0;
  while (total < 1_000_000_000) {
    const path = shortestPath(copy, from, to);
    if (!path) break;
    const cap = Math.min(...path.map((edge) => edge.remainingCents));
    if (cap <= 0) break;
    for (const step of path) {
      const live = copy.find((edge) => edge.obligationId === step.obligationId);
      if (!live) break;
      live.remainingCents -= cap;
    }
    total += cap;
  }
  return total;
}

function takeFlow(
  edges: ResidualEdge[],
  from: string,
  to: string,
  amount: number,
): HouseholdLeg[] {
  const used = new Map<string, number>();
  let left = amount;
  while (left > 0) {
    const path = shortestPath(edges, from, to);
    if (!path) {
      throw new PaymentCalcError(
        "allocation_sum_mismatch",
        "Household plan could not route a payment",
      );
    }
    const cap = Math.min(left, ...path.map((edge) => edge.remainingCents));
    if (cap <= 0) {
      throw new PaymentCalcError(
        "allocation_sum_mismatch",
        "Household plan could not route a payment",
      );
    }
    for (const edge of path) {
      edge.remainingCents -= cap;
      used.set(edge.obligationId, (used.get(edge.obligationId) ?? 0) + cap);
    }
    left -= cap;
  }

  return [...used.entries()]
    .map(([obligationId, amountCents]) => {
      const edge = edges.find((item) => item.obligationId === obligationId);
      if (!edge) {
        throw new PaymentCalcError(
          "allocation_sum_mismatch",
          "Household plan lost an obligation leg",
        );
      }
      return {
        obligationId,
        debtorMembershipId: edge.debtorMembershipId,
        creditorMembershipId: edge.creditorMembershipId,
        amountCents,
      };
    })
    .sort((a, b) => a.obligationId.localeCompare(b.obligationId));
}

function planOneCurrency(
  edges: readonly DirectedObligationEdge[],
): HouseholdSettlementPlan {
  if (edges.length === 0) return { offsets: [], payments: [] };
  const currency = edges[0]?.currency;
  if (!currency || edges.some((edge) => edge.currency !== currency)) {
    throw new PaymentCalcError(
      "currency_mismatch",
      "Household plan edges must share one currency",
    );
  }

  const seen = new Set<string>();
  const residual: ResidualEdge[] = [];
  for (const edge of edges) {
    assertCents(edge.availableCents, "availableCents");
    if (edge.availableCents === 0) continue;
    if (edge.debtorMembershipId === edge.creditorMembershipId) continue;
    if (seen.has(edge.obligationId)) {
      throw new PaymentCalcError(
        "duplicate_obligation_allocation",
        "Each obligation can appear once in a household plan",
      );
    }
    seen.add(edge.obligationId);
    residual.push({ ...edge, remainingCents: edge.availableCents });
  }

  const offsets: HouseholdOffset[] = [];
  for (let step = 0; step < MAX_STEPS; step += 1) {
    const cycle = findCycle(residual);
    if (!cycle) break;
    const amountCents = Math.min(...cycle.map((edge) => edge.remainingCents));
    if (amountCents <= 0) break;
    for (const edge of cycle) edge.remainingCents -= amountCents;
    offsets.push({
      amountCents,
      currency,
      membershipIds: cycle.map((edge) => edge.debtorMembershipId),
      legs: cycle
        .map((edge) => ({
          obligationId: edge.obligationId,
          debtorMembershipId: edge.debtorMembershipId,
          creditorMembershipId: edge.creditorMembershipId,
          amountCents,
        }))
        .sort((a, b) => a.obligationId.localeCompare(b.obligationId)),
    });
  }

  const payments: HouseholdPayment[] = [];
  for (let step = 0; step < MAX_STEPS; step += 1) {
    const nets = new Map<string, number>();
    for (const edge of residual) {
      if (edge.remainingCents <= 0) continue;
      nets.set(
        edge.debtorMembershipId,
        (nets.get(edge.debtorMembershipId) ?? 0) - edge.remainingCents,
      );
      nets.set(
        edge.creditorMembershipId,
        (nets.get(edge.creditorMembershipId) ?? 0) + edge.remainingCents,
      );
    }
    const debtors = [...nets.entries()]
      .filter(([, net]) => net < 0)
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
    if (debtors.length === 0) break;

    const debtor = debtors[0];
    if (!debtor) break;
    const [payer, debtNet] = debtor;
    const debt = -debtNet;
    const creditors = [...nets.entries()]
      .filter(([, net]) => net > 0)
      .sort((a, b) => a[0].localeCompare(b[0]));

    let best: { id: string; cap: number } | null = null;
    for (const [id, credit] of creditors) {
      const cap = Math.min(debt, credit, maxFlow(residual, payer, id));
      if (cap <= 0) continue;
      if (!best || cap > best.cap) best = { id, cap };
    }
    if (!best) {
      throw new PaymentCalcError(
        "allocation_sum_mismatch",
        "Household plan could not match a payment to an open balance",
      );
    }

    payments.push({
      payerMembershipId: payer,
      recipientMembershipId: best.id,
      amountCents: best.cap,
      currency,
      legs: takeFlow(residual, payer, best.id, best.cap),
    });
  }

  if (residual.some((edge) => edge.remainingCents > 0)) {
    throw new PaymentCalcError(
      "allocation_sum_mismatch",
      "Household plan left an open balance",
    );
  }

  return { offsets, payments };
}

/** Build the household plan. Edges in different currencies are planned separately. */
export function planHouseholdSettlement(
  edges: readonly DirectedObligationEdge[],
): HouseholdSettlementPlan {
  const byCurrency = new Map<string, DirectedObligationEdge[]>();
  for (const edge of edges) {
    const group = byCurrency.get(edge.currency) ?? [];
    group.push(edge);
    byCurrency.set(edge.currency, group);
  }
  const offsets: HouseholdOffset[] = [];
  const payments: HouseholdPayment[] = [];
  for (const currency of [...byCurrency.keys()].sort()) {
    const part = planOneCurrency(byCurrency.get(currency) ?? []);
    offsets.push(...part.offsets);
    payments.push(...part.payments);
  }
  return { offsets, payments };
}
