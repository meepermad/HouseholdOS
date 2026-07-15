import type { SettlementState } from "@/lib/payments/types";

/**
 * Whether a stored obligation.status can agree with ledger-derived settlement_state.
 * Derived state from obligation_balances_v is authoritative for UI and balances.
 */
export function storedStatusAgreesWithDerived(params: {
  storedStatus: string;
  settlementState: SettlementState;
  officialOutstandingCents: number;
  effectiveAmountCents: number;
}): boolean {
  const {
    storedStatus,
    settlementState,
    officialOutstandingCents,
    effectiveAmountCents,
  } = params;

  if (officialOutstandingCents < 0) return false;

  if (storedStatus === "reversed" || settlementState === "reversed") {
    return storedStatus === "reversed" && settlementState === "reversed";
  }

  if (settlementState === "settled") {
    // Fully covered by payments and/or waivers.
    return (
      officialOutstandingCents === 0 &&
      (storedStatus === "settled" ||
        storedStatus === "waived" ||
        // Brief race before sync; still not unpaid with positive outstanding.
        (storedStatus === "adjusted" && effectiveAmountCents >= 0) ||
        storedStatus === "pending")
    );
  }

  if (settlementState === "partially_settled") {
    return (
      officialOutstandingCents > 0 &&
      officialOutstandingCents < effectiveAmountCents &&
      (storedStatus === "adjusted" ||
        storedStatus === "pending" ||
        storedStatus === "settled")
    );
  }

  // unpaid
  return (
    settlementState === "unpaid" &&
    officialOutstandingCents === effectiveAmountCents &&
    officialOutstandingCents > 0 &&
    (storedStatus === "pending" || storedStatus === "adjusted")
  );
}

/** After RPC sync, prefer tight agreement (no stale pending when partial). */
export function storedStatusSyncedWithDerived(params: {
  storedStatus: string;
  settlementState: SettlementState;
}): boolean {
  const { storedStatus, settlementState } = params;
  if (settlementState === "reversed") return storedStatus === "reversed";
  if (settlementState === "settled") {
    return storedStatus === "settled" || storedStatus === "waived";
  }
  if (settlementState === "partially_settled") {
    return storedStatus === "adjusted";
  }
  return storedStatus === "pending";
}
