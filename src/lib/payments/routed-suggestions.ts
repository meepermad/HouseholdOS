/**
 * Deterministic A→B→C routed settlement suggestions ("Simplify balances").
 * Ranking: amount desc, then stable membership/obligation id ties. Manual propose only.
 */

export type DirectedObligationEdge = {
  obligationId: string;
  debtorMembershipId: string;
  creditorMembershipId: string;
  availableCents: number;
  currency: string;
};

export type RoutedSettlementSuggestion = {
  payerMembershipId: string;
  intermediaryMembershipId: string;
  recipientMembershipId: string;
  obligationAbId: string;
  obligationBcId: string;
  amountCents: number;
  currency: string;
  beforeEdges: { ab: number; bc: number };
  afterEdges: { ab: number; bc: number };
};

function cmpId(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Find one-intermediary routes where A owes B and B owes C.
 * Amount = min(available A→B, available B→C). Partial routes allowed.
 */
export function suggestRoutedSettlements(
  edges: readonly DirectedObligationEdge[],
  options?: { maxSuggestions?: number },
): RoutedSettlementSuggestion[] {
  const max = options?.maxSuggestions ?? 20;
  const positive = edges.filter((e) => e.availableCents > 0);
  const suggestions: RoutedSettlementSuggestion[] = [];

  for (const ab of positive) {
    for (const bc of positive) {
      if (ab.obligationId === bc.obligationId) continue;
      if (ab.creditorMembershipId !== bc.debtorMembershipId) continue;
      if (ab.debtorMembershipId === bc.creditorMembershipId) continue;
      if (ab.debtorMembershipId === ab.creditorMembershipId) continue;
      if (ab.currency !== bc.currency) continue;

      const amount = Math.min(ab.availableCents, bc.availableCents);
      if (amount <= 0) continue;

      suggestions.push({
        payerMembershipId: ab.debtorMembershipId,
        intermediaryMembershipId: ab.creditorMembershipId,
        recipientMembershipId: bc.creditorMembershipId,
        obligationAbId: ab.obligationId,
        obligationBcId: bc.obligationId,
        amountCents: amount,
        currency: ab.currency,
        beforeEdges: { ab: ab.availableCents, bc: bc.availableCents },
        afterEdges: {
          ab: ab.availableCents - amount,
          bc: bc.availableCents - amount,
        },
      });
    }
  }

  suggestions.sort((a, b) => {
    if (b.amountCents !== a.amountCents) return b.amountCents - a.amountCents;
    const t1 = cmpId(a.payerMembershipId, b.payerMembershipId);
    if (t1 !== 0) return t1;
    const t2 = cmpId(a.intermediaryMembershipId, b.intermediaryMembershipId);
    if (t2 !== 0) return t2;
    const t3 = cmpId(a.recipientMembershipId, b.recipientMembershipId);
    if (t3 !== 0) return t3;
    const t4 = cmpId(a.obligationAbId, b.obligationAbId);
    if (t4 !== 0) return t4;
    return cmpId(a.obligationBcId, b.obligationBcId);
  });

  return suggestions.slice(0, max);
}

export function maxRoutableCents(abAvailable: number, bcAvailable: number): number {
  if (!Number.isInteger(abAvailable) || !Number.isInteger(bcAvailable)) return 0;
  return Math.max(0, Math.min(abAvailable, bcAvailable));
}

export function isEligibleRoutedTriple(params: {
  payerId: string;
  intermediaryId: string;
  recipientId: string;
  abAvailable: number;
  bcAvailable: number;
  amountCents: number;
  sameCurrency: boolean;
  disputed: boolean;
}): { ok: true } | { ok: false; reason: string } {
  const {
    payerId,
    intermediaryId,
    recipientId,
    abAvailable,
    bcAvailable,
    amountCents,
    sameCurrency,
    disputed,
  } = params;
  if (disputed) return { ok: false, reason: "disputed" };
  if (!sameCurrency) return { ok: false, reason: "currency_mismatch" };
  if (
    payerId === intermediaryId ||
    intermediaryId === recipientId ||
    payerId === recipientId
  ) {
    return { ok: false, reason: "parties_not_distinct" };
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, reason: "invalid_amount" };
  }
  const max = maxRoutableCents(abAvailable, bcAvailable);
  if (amountCents > max) return { ok: false, reason: "exceeds_available" };
  return { ok: true };
}
