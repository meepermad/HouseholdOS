/**
 * Simple roommate-facing ownership mapped onto stored classifications.
 * Internal allocation modes stay hidden from the default UI.
 */

import type { LineItemClassification } from "./types";
import type { LineOwnershipKind } from "./types";

export type SimpleOwnership = {
  kind: LineOwnershipKind;
  /** Members who share or own this line. Empty means unclaimed or household-all. */
  membershipIds: string[];
};

export function classificationToSimpleOwnership(input: {
  classification: LineItemClassification;
  participantMembershipIds: readonly string[];
  currentMembershipId: string;
  payerMembershipId: string;
}): SimpleOwnership {
  const participants = [...input.participantMembershipIds];
  switch (input.classification) {
    case "excluded":
      return { kind: "excluded", membershipIds: [] };
    case "shared_household":
      return { kind: "household", membershipIds: [] };
    case "shared_selected":
      return { kind: "shared", membershipIds: participants };
    case "personal_purchaser":
      return {
        kind:
          input.currentMembershipId === input.payerMembershipId ? "mine" : "someone_else",
        membershipIds: [input.payerMembershipId],
      };
    case "personal_other": {
      const owner = participants[0];
      if (!owner) return { kind: "unclaimed", membershipIds: [] };
      return {
        kind: owner === input.currentMembershipId ? "mine" : "someone_else",
        membershipIds: [owner],
      };
    }
    case "needs_review":
    default:
      return { kind: "unclaimed", membershipIds: [] };
  }
}

export function simpleOwnershipToClassification(input: {
  kind: LineOwnershipKind;
  membershipIds: readonly string[];
  currentMembershipId: string;
  payerMembershipId: string;
}): { classification: LineItemClassification; participantMembershipIds: string[] } {
  switch (input.kind) {
    case "excluded":
      return { classification: "excluded", participantMembershipIds: [] };
    case "household":
      return { classification: "shared_household", participantMembershipIds: [] };
    case "shared":
      return {
        classification: "shared_selected",
        participantMembershipIds: [...input.membershipIds],
      };
    case "mine":
      if (input.currentMembershipId === input.payerMembershipId) {
        return { classification: "personal_purchaser", participantMembershipIds: [] };
      }
      return {
        classification: "personal_other",
        participantMembershipIds: [input.currentMembershipId],
      };
    case "someone_else": {
      const owner = input.membershipIds[0];
      if (!owner) {
        return { classification: "needs_review", participantMembershipIds: [] };
      }
      if (owner === input.payerMembershipId) {
        return { classification: "personal_purchaser", participantMembershipIds: [] };
      }
      return { classification: "personal_other", participantMembershipIds: [owner] };
    }
    case "quantity":
      return {
        classification: "shared_selected",
        participantMembershipIds: [...input.membershipIds],
      };
    case "unclaimed":
    default:
      return { classification: "needs_review", participantMembershipIds: [] };
  }
}

export function ownershipLabel(kind: LineOwnershipKind, memberName?: string): string {
  switch (kind) {
    case "mine":
      return "Yours";
    case "someone_else":
      return memberName ? `${memberName}'s` : "Someone else";
    case "shared":
      return "Shared";
    case "household":
      return "Shared with everyone";
    case "excluded":
      return "Not reimbursed";
    case "quantity":
      return "Split by quantity";
    case "unclaimed":
    default:
      return "Unclaimed";
  }
}
