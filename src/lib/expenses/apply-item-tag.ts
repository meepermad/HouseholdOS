export const RETAG_MODES = [
  "personal",
  "equal_all",
  "equal_selected",
  "excluded",
] as const;

export type RetagMode = (typeof RETAG_MODES)[number];

export type ItemTagWrite = {
  allocationMode: RetagMode;
  personalMembershipId: string | null;
  participants: Array<{ membershipId: string }>;
  classification: string;
};

export function itemTagToWrite(input: {
  allocationMode: RetagMode;
  personalMembershipId?: string | null;
  membershipIds?: readonly string[];
  payerMembershipId: string;
}): ItemTagWrite {
  if (input.allocationMode === "personal") {
    const owner = input.personalMembershipId ?? "";
    return {
      allocationMode: "personal",
      personalMembershipId: owner || null,
      participants: owner ? [{ membershipId: owner }] : [],
      classification:
        owner && owner === input.payerMembershipId
          ? "personal_purchaser"
          : "personal_other",
    };
  }
  if (input.allocationMode === "excluded") {
    return {
      allocationMode: "excluded",
      personalMembershipId: null,
      participants: [],
      classification: "excluded",
    };
  }
  if (input.allocationMode === "equal_selected") {
    const ids = [...new Set(input.membershipIds ?? [])];
    return {
      allocationMode: "equal_selected",
      personalMembershipId: null,
      participants: ids.map((membershipId) => ({ membershipId })),
      classification: "shared_selected",
    };
  }
  return {
    allocationMode: "equal_all",
    personalMembershipId: null,
    participants: [],
    classification: "shared_household",
  };
}
