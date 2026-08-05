/**
 * Rules for turning a reviewed receipt into a draft expense.
 *
 * These mirror `confirm_receipt_as_expense`, which is the source of truth —
 * the RPC does the write. Keeping the rules here lets the review screen show
 * the member what confirming will produce before they commit to it.
 */

import type { ItemAllocationMode } from "@/types/database";
import type { LineItemClassification } from "./types";

export type ReceiptItemPlan = {
  allocationMode: ItemAllocationMode;
  /** Owner for personal lines, when it can be determined without guessing. */
  personalMembershipId: string | null;
  /** Allocation input rows to create for shared-with-some lines. */
  participantMembershipIds: string[];
  /** True when the draft will ask who owns this line before it can confirm. */
  needsOwner: boolean;
};

/**
 * Decide how one receipt line becomes an expense item.
 *
 * A line marked personal to someone else with nobody chosen stays unassigned
 * rather than defaulting to the purchaser — the draft editor asks instead.
 */
export function planReceiptItem(input: {
  classification: LineItemClassification;
  purchaserMembershipId: string;
  participantMembershipIds: readonly string[];
}): ReceiptItemPlan {
  const participants = [...input.participantMembershipIds];

  switch (input.classification) {
    case "personal_purchaser":
      return {
        allocationMode: "personal",
        personalMembershipId: input.purchaserMembershipId,
        participantMembershipIds: [],
        needsOwner: false,
      };
    case "personal_other": {
      const owner = participants[0] ?? null;
      return {
        allocationMode: "personal",
        personalMembershipId: owner,
        participantMembershipIds: [],
        needsOwner: owner === null,
      };
    }
    case "shared_selected":
      if (participants.length === 0) {
        // Marked shared but nobody selected: shared with everyone.
        return {
          allocationMode: "equal_all",
          personalMembershipId: null,
          participantMembershipIds: [],
          needsOwner: false,
        };
      }
      return {
        allocationMode: "equal_selected",
        personalMembershipId: null,
        participantMembershipIds: participants,
        needsOwner: false,
      };
    case "excluded":
      return {
        allocationMode: "excluded",
        personalMembershipId: null,
        participantMembershipIds: [],
        needsOwner: false,
      };
    default:
      return {
        allocationMode: "equal_all",
        personalMembershipId: null,
        participantMembershipIds: [],
        needsOwner: false,
      };
  }
}

export type ReceiptAdjustmentPlan = {
  type: "tax" | "tip";
  description: string;
  amountCents: number;
};

/**
 * Extracted tax and tip become adjustments, capped by the gap between the
 * line items and the declared total so the draft can never exceed what was
 * actually charged. Anything left over is surfaced as a difference to resolve
 * rather than absorbed silently.
 */
export function planReceiptAdjustments(input: {
  declaredTotalCents: number;
  itemSubtotalCents: number;
  taxCents: number | null;
  tipCents: number | null;
}): ReceiptAdjustmentPlan[] {
  const plans: ReceiptAdjustmentPlan[] = [];
  let remaining = input.declaredTotalCents - input.itemSubtotalCents;
  if (remaining <= 0) return plans;

  const tax = Math.max(input.taxCents ?? 0, 0);
  if (tax > 0) {
    const amountCents = Math.min(tax, remaining);
    plans.push({ type: "tax", description: "Tax", amountCents });
    remaining -= amountCents;
  }

  const tip = Math.max(input.tipCents ?? 0, 0);
  if (remaining > 0 && tip > 0) {
    plans.push({
      type: "tip",
      description: "Tip",
      amountCents: Math.min(tip, remaining),
    });
  }

  return plans;
}
