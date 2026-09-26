export type SettledHistoryObligation = {
  obligationId: string;
  expenseId: string | null;
  kind: string;
  counterpartyMembershipId: string;
};

export type SettledRelationship = {
  counterpartyMembershipId: string;
  obligations: SettledHistoryObligation[];
};

type ObligationRow = {
  obligation_id: string;
  debtor_membership_id: string;
  creditor_membership_id: string;
  expense_id: string | null;
  obligation_kind: string;
  official_outstanding_cents: number;
  pending_payment_cents: number;
};

/**
 * Relationships whose every obligation is fully settled.
 * Open or pending pairs stay on the outstanding list.
 */
export function settledRelationships(params: {
  viewerMembershipId: string;
  obligations: readonly ObligationRow[];
}): SettledRelationship[] {
  const byCounterparty = new Map<string, ObligationRow[]>();
  for (const row of params.obligations) {
    const counterparty =
      row.debtor_membership_id === params.viewerMembershipId
        ? row.creditor_membership_id
        : row.creditor_membership_id === params.viewerMembershipId
          ? row.debtor_membership_id
          : null;
    if (!counterparty) continue;
    const list = byCounterparty.get(counterparty) ?? [];
    list.push(row);
    byCounterparty.set(counterparty, list);
  }

  const settled: SettledRelationship[] = [];
  for (const [counterpartyMembershipId, rows] of byCounterparty) {
    const stillOpen = rows.some(
      (row) => row.official_outstanding_cents > 0 || row.pending_payment_cents > 0,
    );
    if (stillOpen || rows.length === 0) continue;
    settled.push({
      counterpartyMembershipId,
      obligations: rows
        .map((row) => ({
          obligationId: row.obligation_id,
          expenseId: row.expense_id,
          kind: row.obligation_kind,
          counterpartyMembershipId,
        }))
        .sort((a, b) => a.obligationId.localeCompare(b.obligationId)),
    });
  }

  return settled.sort((a, b) =>
    a.counterpartyMembershipId.localeCompare(b.counterpartyMembershipId),
  );
}
