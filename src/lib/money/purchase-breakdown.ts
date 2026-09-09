export type PurchaseBreakdownShare = {
  membershipId: string;
  name: string;
  amountCents: number;
};

export type PurchaseBreakdownLine = {
  id: string;
  name: string;
  totalCents: number;
  tagged: string;
  shares: PurchaseBreakdownShare[];
};

export function formatTaggedPeople(input: {
  names: readonly string[];
  everyone?: boolean;
  excluded?: boolean;
  unassigned?: boolean;
}): string {
  if (input.excluded) return "Not reimbursed";
  if (input.unassigned) return "Unassigned";
  if (input.everyone) return "Everyone";
  const names = input.names.filter(Boolean);
  if (names.length === 0) return "Unassigned";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

type AllocatedRow = {
  id: string;
  name: string;
  totalCents: number;
  allocationMode: string;
  personalMembershipId?: string | null;
  allocations: Array<{
    membership_id: string;
    amount_cents: number;
  }>;
};

export function allocatedRowsToBreakdown(
  rows: readonly AllocatedRow[],
  label: (membershipId: string) => string,
): PurchaseBreakdownLine[] {
  return rows.map((row) => {
    const shareAllocs = row.allocations.filter((a) => a.amount_cents !== 0);
    const everyone =
      row.allocationMode === "equal_all" || row.allocationMode === "proportional";
    const excluded = row.allocationMode === "excluded";
    const names =
      row.allocationMode === "personal" || row.allocationMode === "assigned"
        ? [
            label(
              row.personalMembershipId ?? shareAllocs[0]?.membership_id ?? "",
            ),
          ].filter(Boolean)
        : shareAllocs.map((a) => label(a.membership_id));
    return {
      id: row.id,
      name: row.name || "Item",
      totalCents: row.totalCents,
      tagged: formatTaggedPeople({
        names,
        everyone,
        excluded,
        unassigned: !excluded && !everyone && names.length === 0,
      }),
      shares: shareAllocs.map((a) => ({
        membershipId: a.membership_id,
        name: label(a.membership_id),
        amountCents: a.amount_cents,
      })),
    };
  });
}
