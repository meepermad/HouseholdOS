/**
 * Roommate-facing "who owes whom" preview for a reviewed receipt.
 * Uses the same integer-cent engine as confirmed expenses.
 */

import { calculateExpense } from "@/lib/expenses/calculate-expense";
import { splitEvenlyDeterministic } from "@/lib/expenses/rounding";
import type { ExpenseItemInput, MemberAllocationInput } from "@/lib/expenses/types";
import type { LineItemClassification } from "./types";
import { planReceiptAdjustments, planReceiptItem } from "./expense-handoff";
import { allocateQuantityClaims, type LineClaim } from "./claims";

export type PreviewLine = {
  id: string;
  name: string;
  totalCents: number;
  classification: LineItemClassification;
  participantMembershipIds: string[];
  quantity: number | null;
  claims?: LineClaim[];
};

export type MemberShareRow = {
  membershipId: string;
  itemCount: number;
  subtotalCents: number;
  taxShareCents: number;
  tipShareCents: number;
  discountShareCents: number;
  totalCents: number;
  owesPayerCents: number;
};

export type SplitPreview = {
  merchant: string;
  payerMembershipId: string;
  declaredTotalCents: number;
  itemSubtotalCents: number;
  unclaimed: { count: number; cents: number };
  excludedCents: number;
  householdSharedCents: number;
  personalByMember: Array<{ membershipId: string; cents: number; itemCount: number }>;
  members: MemberShareRow[];
  payerOwnShareCents: number;
  othersOwePayerCents: number;
  taxCents: number;
  tipCents: number;
  discountCents: number;
  balanced: boolean;
  remainderCents: number;
};

function quantityToFixedParticipants(
  line: PreviewLine,
): MemberAllocationInput[] | null {
  if (!line.claims || line.claims.length === 0) return null;
  const qty = line.claims.filter(
    (c) => c.kind === "mine" || c.kind === "assigned" || c.kind === "quantity",
  );
  if (qty.length === 0) return null;
  const allocated = allocateQuantityClaims({
    totalCents: line.totalCents,
    totalQuantity: line.quantity,
    claims: qty,
  });
  return allocated.map((a) => ({
    membershipId: a.membershipId,
    fixedCents: a.amountCents,
  }));
}

export function buildReceiptExpenseItems(input: {
  lines: readonly PreviewLine[];
  purchaserMembershipId: string;
  eligibleMembershipIds: readonly string[];
  splitEverything?: { membershipIds: readonly string[] } | null;
  declaredTotalCents: number;
}): ExpenseItemInput[] {
  if (input.splitEverything && input.splitEverything.membershipIds.length > 0) {
    const ids = [...input.splitEverything.membershipIds];
    const allHousehold =
      ids.length === input.eligibleMembershipIds.length &&
      ids.every((id) => input.eligibleMembershipIds.includes(id));
    return [
      {
        id: "receipt-whole",
        description: "Receipt",
        totalCents: input.declaredTotalCents,
        allocationMode: allHousehold ? "equal_all" : "equal_selected",
        participants: allHousehold
          ? undefined
          : ids.map((membershipId) => ({ membershipId })),
      },
    ];
  }

  return input.lines
    .filter((line) => line.classification !== "excluded")
    .map((line) => {
      const fixed = quantityToFixedParticipants(line);
      if (fixed && fixed.length > 0) {
        return {
          id: line.id,
          description: line.name,
          totalCents: line.totalCents,
          allocationMode: "fixed_cents" as const,
          participants: fixed,
        };
      }
      const plan = planReceiptItem({
        classification: line.classification,
        purchaserMembershipId: input.purchaserMembershipId,
        participantMembershipIds: line.participantMembershipIds,
      });
      return {
        id: line.id,
        description: line.name,
        totalCents: line.totalCents,
        allocationMode: plan.allocationMode,
        personalMembershipId: plan.personalMembershipId ?? undefined,
        participants: plan.participantMembershipIds.map((membershipId) => ({
          membershipId,
        })),
      } satisfies ExpenseItemInput;
    });
}

export function previewReceiptSplit(input: {
  merchant: string;
  payerMembershipId: string;
  eligibleMembershipIds: readonly string[];
  declaredTotalCents: number;
  taxCents: number | null;
  tipCents: number | null;
  discountCents?: number | null;
  lines: readonly PreviewLine[];
  splitEverything?: { membershipIds: readonly string[] } | null;
}): SplitPreview {
  const itemSubtotalCents = input.lines.reduce(
    (sum, l) => sum + (l.classification === "excluded" ? 0 : l.totalCents),
    0,
  );
  const unclaimedLines = input.lines.filter(
    (l) => l.classification === "needs_review",
  );
  const unclaimed = {
    count: unclaimedLines.length,
    cents: unclaimedLines.reduce((sum, l) => sum + l.totalCents, 0),
  };
  const excludedCents = input.lines
    .filter((l) => l.classification === "excluded")
    .reduce((sum, l) => sum + l.totalCents, 0);
  const householdSharedCents = input.lines
    .filter((l) => l.classification === "shared_household")
    .reduce((sum, l) => sum + l.totalCents, 0);

  const personalMap = new Map<string, { cents: number; itemCount: number }>();
  for (const line of input.lines) {
    if (line.classification !== "personal_purchaser" && line.classification !== "personal_other") {
      continue;
    }
    const owner =
      line.classification === "personal_purchaser"
        ? input.payerMembershipId
        : (line.participantMembershipIds[0] ?? input.payerMembershipId);
    const prev = personalMap.get(owner) ?? { cents: 0, itemCount: 0 };
    personalMap.set(owner, {
      cents: prev.cents + line.totalCents,
      itemCount: prev.itemCount + 1,
    });
  }

  const assignedLines = input.splitEverything
    ? input.lines
    : input.lines.filter((l) => l.classification !== "needs_review");
  const assignedSubtotal = assignedLines
    .filter((l) => l.classification !== "excluded")
    .reduce((sum, l) => sum + l.totalCents, 0);
  const items = buildReceiptExpenseItems({
    lines: assignedLines,
    purchaserMembershipId: input.payerMembershipId,
    eligibleMembershipIds: input.eligibleMembershipIds,
    splitEverything: input.splitEverything,
    declaredTotalCents: input.declaredTotalCents,
  });

  const adjustments = planReceiptAdjustments({
    declaredTotalCents: input.declaredTotalCents,
    itemSubtotalCents: input.splitEverything
      ? input.declaredTotalCents
      : assignedSubtotal,
    taxCents: input.taxCents,
    tipCents: input.tipCents,
    discountCents: input.discountCents,
  });

  const splitEverything = Boolean(input.splitEverything);
  const adjustmentInputs = splitEverything
    ? []
    : adjustments.map((a, i) => ({
        id: `adj-${i}`,
        type: a.type,
        description: a.description,
        amountCents: a.amountCents,
        allocationMode: "proportional" as const,
      }));
  const calcDeclared = splitEverything
    ? input.declaredTotalCents
    : assignedSubtotal + adjustmentInputs.reduce((sum, a) => sum + a.amountCents, 0);
  const calc =
    items.length === 0 || calcDeclared < 0
      ? { ok: false as const }
      : calculateExpense({
          currency: "USD",
          householdCurrency: "USD",
          declaredTotalCents: calcDeclared,
          payerMembershipId: input.payerMembershipId,
          eligibleMembershipIds: [...input.eligibleMembershipIds],
          items,
          adjustments: adjustmentInputs,
        });

  const memberRows: MemberShareRow[] = [];
  if (calc.ok) {
    for (const share of calc.memberShares) {
      const itemCount = input.lines.filter((l) => {
        if (l.classification === "excluded" || l.classification === "needs_review") {
          return false;
        }
        if (l.classification === "shared_household") return true;
        if (l.classification === "personal_purchaser") {
          return share.membershipId === input.payerMembershipId;
        }
        if (l.classification === "personal_other" || l.classification === "shared_selected") {
          return l.participantMembershipIds.includes(share.membershipId);
        }
        return false;
      }).length;
      const owes =
        share.membershipId === input.payerMembershipId
          ? 0
          : Math.max(0, share.totalShareCents);
      memberRows.push({
        membershipId: share.membershipId,
        itemCount,
        subtotalCents: share.itemSubtotalCents,
        taxShareCents: 0,
        tipShareCents: 0,
        discountShareCents: 0,
        totalCents: share.totalShareCents,
        owesPayerCents: owes,
      });
    }
  } else if (input.splitEverything) {
    const split = splitEvenlyDeterministic(
      input.declaredTotalCents,
      input.splitEverything.membershipIds,
    );
    for (const row of split) {
      memberRows.push({
        membershipId: row.membershipId,
        itemCount: 0,
        subtotalCents: row.amountCents,
        taxShareCents: 0,
        tipShareCents: 0,
        discountShareCents: 0,
        totalCents: row.amountCents,
        owesPayerCents:
          row.membershipId === input.payerMembershipId ? 0 : row.amountCents,
      });
    }
  }

  const payerRow = memberRows.find((m) => m.membershipId === input.payerMembershipId);
  const othersOwePayerCents = memberRows
    .filter((m) => m.membershipId !== input.payerMembershipId)
    .reduce((sum, m) => sum + m.owesPayerCents, 0);

  const allocatedSum = memberRows.reduce((sum, m) => sum + m.totalCents, 0);
  const remainderCents = input.declaredTotalCents - allocatedSum;

  return {
    merchant: input.merchant,
    payerMembershipId: input.payerMembershipId,
    declaredTotalCents: input.declaredTotalCents,
    itemSubtotalCents,
    unclaimed,
    excludedCents,
    householdSharedCents,
    personalByMember: [...personalMap.entries()].map(([membershipId, v]) => ({
      membershipId,
      cents: v.cents,
      itemCount: v.itemCount,
    })),
    members: memberRows,
    payerOwnShareCents: payerRow?.totalCents ?? 0,
    othersOwePayerCents,
    taxCents: adjustments.find((a) => a.type === "tax")?.amountCents ?? 0,
    tipCents: adjustments.find((a) => a.type === "tip")?.amountCents ?? 0,
    discountCents: Math.abs(adjustments.find((a) => a.type === "discount")?.amountCents ?? 0),
    balanced: calc.ok ? remainderCents === 0 || Math.abs(remainderCents) <= 1 : false,
    remainderCents,
  };
}
