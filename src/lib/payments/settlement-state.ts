import type { SettlementState } from "@/lib/payments/types";

export function deriveSettlementState(params: {
  effectiveAmountCents: number;
  officialOutstandingCents: number;
  isReversed?: boolean;
}): SettlementState {
  if (params.isReversed) return "reversed";
  if (params.effectiveAmountCents <= 0) return "settled";
  if (params.officialOutstandingCents <= 0) return "settled";
  if (params.officialOutstandingCents < params.effectiveAmountCents) {
    return "partially_settled";
  }
  return "unpaid";
}
