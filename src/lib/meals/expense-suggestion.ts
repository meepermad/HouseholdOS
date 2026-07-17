import type { GuestCostPolicy } from "./types";

export type MealExpenseParticipant = {
  membershipId: string;
  displayName: string;
  /** Guests this participant is hosting (count only). */
  guestCount: number;
};

export type MealExpenseSuggestionInput = {
  totalCents: number;
  participants: readonly MealExpenseParticipant[];
  /** Members who did not participate — excluded from split. */
  nonParticipants?: readonly MealExpenseParticipant[];
  guestCostPolicy: GuestCostPolicy;
  /** Host membership covering guests when policy is host_covers. */
  hostMembershipId?: string | null;
  organizerMembershipId: string;
};

export type MealExpenseShare = {
  membershipId: string;
  displayName: string;
  shareCents: number;
  guestSharesCovered: number;
};

export type MealExpenseSuggestion = {
  policy: GuestCostPolicy;
  shares: MealExpenseShare[];
  explanation: string[];
  /** Never auto-confirms — purchaser must review via expense workflow. */
  requiresManualConfirmation: true;
};

/**
 * Suggest allocation only. Does not create or confirm expenses.
 */
export function suggestMealExpenseAllocation(
  input: MealExpenseSuggestionInput,
): MealExpenseSuggestion {
  const explanations: string[] = [];
  const participants = input.participants;
  if (participants.length === 0 || input.totalCents <= 0) {
    return {
      policy: input.guestCostPolicy,
      shares: [],
      explanation: ["No allocation suggested."],
      requiresManualConfirmation: true,
    };
  }

  const shares: MealExpenseShare[] = participants.map((p) => ({
    membershipId: p.membershipId,
    displayName: p.displayName,
    shareCents: 0,
    guestSharesCovered: 0,
  }));

  const byId = new Map(shares.map((s) => [s.membershipId, s]));

  // Person-units: each participant = 1, plus guests attributed per policy
  type Unit = { membershipId: string; weight: number };
  const units: Unit[] = [];

  for (const p of participants) {
    units.push({ membershipId: p.membershipId, weight: 1 });
    if (p.guestCount <= 0) continue;

    switch (input.guestCostPolicy) {
      case "host_covers": {
        const hostId = input.hostMembershipId ?? p.membershipId;
        units.push({ membershipId: hostId, weight: p.guestCount });
        const hostShare = byId.get(hostId);
        if (hostShare) hostShare.guestSharesCovered += p.guestCount;
        explanations.push(
          `${p.displayName}'s ${p.guestCount} guest(s) covered by host.`,
        );
        break;
      }
      case "organizer_covers": {
        units.push({
          membershipId: input.organizerMembershipId,
          weight: p.guestCount,
        });
        const org = byId.get(input.organizerMembershipId);
        if (org) org.guestSharesCovered += p.guestCount;
        explanations.push(
          `${p.guestCount} guest share(s) covered by organizer.`,
        );
        break;
      }
      case "excluded_from_split":
        explanations.push(
          `${p.guestCount} guest(s) excluded from the split.`,
        );
        break;
      case "manual":
        explanations.push("Guest costs left for manual allocation.");
        break;
      case "participants_share":
      default:
        // Spread guest weight across all participants equally via adding to total units pool on organizer then redistribute — simpler: add guest weight to each guest's host then split all weights
        units.push({ membershipId: p.membershipId, weight: p.guestCount });
        const host = byId.get(p.membershipId);
        if (host) host.guestSharesCovered += p.guestCount;
        explanations.push(
          `${p.guestCount} guest share(s) included with participants.`,
        );
        break;
    }
  }

  if (input.guestCostPolicy === "manual") {
    return {
      policy: input.guestCostPolicy,
      shares: shares.map((s) => ({ ...s, shareCents: 0 })),
      explanation: [
        ...explanations,
        "Manual guest-cost policy — purchaser must set shares.",
      ],
      requiresManualConfirmation: true,
    };
  }

  // Collapse weights per membership
  const weightByMember = new Map<string, number>();
  for (const u of units) {
    if (!byId.has(u.membershipId)) {
      // host/organizer may not be in participants — add placeholder
      shares.push({
        membershipId: u.membershipId,
        displayName: u.membershipId === input.organizerMembershipId
          ? "Organizer"
          : "Host",
        shareCents: 0,
        guestSharesCovered: 0,
      });
      byId.set(u.membershipId, shares[shares.length - 1]!);
    }
    weightByMember.set(
      u.membershipId,
      (weightByMember.get(u.membershipId) ?? 0) + u.weight,
    );
  }

  const totalWeight = [...weightByMember.values()].reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) {
    return {
      policy: input.guestCostPolicy,
      shares: [],
      explanation: ["No allocation weight."],
      requiresManualConfirmation: true,
    };
  }

  let allocated = 0;
  const entries = [...weightByMember.entries()];
  entries.forEach(([membershipId, weight], index) => {
    const share =
      index === entries.length - 1
        ? input.totalCents - allocated
        : Math.floor((input.totalCents * weight) / totalWeight);
    allocated += share;
    const row = byId.get(membershipId);
    if (row) row.shareCents = share;
  });

  if (input.nonParticipants?.length) {
    explanations.push(
      `${input.nonParticipants.map((n) => n.displayName).join(", ")} did not participate.`,
    );
  }
  explanations.push("Purchaser must review and confirm through expenses.");

  return {
    policy: input.guestCostPolicy,
    shares: shares.filter((s) => s.shareCents > 0 || byId.has(s.membershipId)),
    explanation: explanations,
    requiresManualConfirmation: true,
  };
}
