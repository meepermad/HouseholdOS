import { claimedQuantity, lineQuantity } from "@/lib/receipts/claims";
import type { ParsedPasteReceipt } from "./parse";
import { pastedLinePersistenceFields } from "./display-description";
import { isReceiptRepasteEditable } from "./display-description";
import { reconcileReceiptLines, type ReconciledLine } from "./line-reconcile";
import {
  buildRepasteDiffRows,
  claimedOwnerLabel,
  incomingReconciliation,
  lineHasOwnership,
  summarizeRepasteFinancial,
  type CurrentRepasteLine,
  type RepasteDiffRow,
} from "./repaste-diff";

export type DescriptionChoice = "keep_current" | "use_new";

export type RepasteUserChoices = {
  acceptedRemovedClaimLineIds?: string[];
  descriptionChoices?: Record<string, DescriptionChoice>;
  retainInvalidDraft?: boolean;
};

export type RepasteLinePlan = {
  action: "keep" | "update" | "add" | "remove";
  currentId?: string;
  incomingIndex?: number;
  displayDescription: string;
  sourceText: string;
  totalCents: number;
  quantity: number;
  preserveDescription: boolean;
  financialReviewRequired: boolean;
  claimReviewRequired: boolean;
  preserveClaims: boolean;
  preserveAssignment: boolean;
  claimedQuantityExceedsNew?: boolean;
  remainingUnclaimed?: number;
  claimedByLabel?: string | null;
  requiresRemovalConfirmation?: boolean;
};

export type RepastePlan = {
  receiptId: string;
  sameReceipt: true;
  editable: boolean;
  finalized: boolean;
  claimingActive: boolean;
  claimingWarning: string | null;
  rows: RepasteDiffRow[];
  lines: RepasteLinePlan[];
  matches: ReconciledLine[];
  descriptionOnly: boolean;
  financialChanged: boolean;
  confirmationCopy: string;
  financialWarning: string | null;
  reconciliation: {
    balanced: boolean;
    differenceCents: number;
    copy: string | null;
  };
  claimedRemovals: Array<{ lineId: string; name: string; belongsTo: string }>;
  descriptionConflicts: Array<{
    lineId: string;
    currentName: string;
    newName: string;
  }>;
  canActivate: boolean;
  canStartCorrection: boolean;
  applyBlockedReason: string | null;
  notify: boolean;
  header: {
    merchant: string | null;
    purchaseDate: string | null;
    totalCents: number | null;
    subtotalCents: number | null;
    taxCents: number | null;
    tipCents: number | null;
    feeCents: number | null;
    discountCents: number | null;
  };
};

export type CurrentRepasteSnapshot = {
  receiptId: string;
  status: string;
  merchant: string | null;
  purchaseDate: string | null;
  totalCents: number | null;
  subtotalCents: number | null;
  taxCents: number | null;
  tipCents: number | null;
  feeCents: number | null;
  discountCents: number | null;
  lines: CurrentRepasteLine[];
};

function incomingName(item: { description: string; raw: string }): string {
  return pastedLinePersistenceFields(item).displayDescription;
}

export function buildRepastePlan(
  current: CurrentRepasteSnapshot,
  incoming: ParsedPasteReceipt,
  choices: RepasteUserChoices = {},
): RepastePlan {
  const finalized = current.status === "confirmed";
  const editable = isReceiptRepasteEditable(current.status);
  const claimingActive = current.status === "claiming";
  const matches = reconcileReceiptLines(current.lines, incoming.items);
  const currentById = new Map(current.lines.map((l) => [l.id, l]));
  const rows = buildRepasteDiffRows({ current, incoming, matches });
  const summary = summarizeRepasteFinancial(rows);
  const recon = incomingReconciliation(incoming);
  const acceptedRemoved = new Set(choices.acceptedRemovedClaimLineIds ?? []);
  const descriptionChoices = choices.descriptionChoices ?? {};

  const claimedRemovals: RepastePlan["claimedRemovals"] = [];
  const descriptionConflicts: RepastePlan["descriptionConflicts"] = [];
  const lines: RepasteLinePlan[] = [];

  for (const match of matches) {
    if (match.action === "add") {
      const persisted = pastedLinePersistenceFields(match.incoming);
      lines.push({
        action: "add",
        incomingIndex: match.incomingIndex,
        displayDescription: persisted.displayDescription,
        sourceText: persisted.sourceText,
        totalCents: match.incoming.totalCents,
        quantity: lineQuantity(match.incoming.quantity),
        preserveDescription: false,
        financialReviewRequired: true,
        claimReviewRequired: false,
        preserveClaims: false,
        preserveAssignment: false,
      });
      continue;
    }
    if (match.action === "remove") {
      const currentLine = currentById.get(match.currentId);
      const owned = currentLine ? lineHasOwnership(currentLine) : false;
      const owner = currentLine ? claimedOwnerLabel(currentLine.claims) : null;
      if (owned && currentLine) {
        claimedRemovals.push({
          lineId: currentLine.id,
          name: currentLine.displayDescription,
          belongsTo: owner ?? "a roommate",
        });
      }
      lines.push({
        action: "remove",
        currentId: match.currentId,
        displayDescription: match.current.displayDescription,
        sourceText: match.current.sourceText,
        totalCents: match.current.totalCents,
        quantity: lineQuantity(match.current.quantity),
        preserveDescription: true,
        financialReviewRequired: owned,
        claimReviewRequired: owned,
        preserveClaims: false,
        preserveAssignment: false,
        claimedByLabel: owner,
        requiresRemovalConfirmation: owned,
      });
      continue;
    }

    const currentLine = currentById.get(match.currentId);
    if (!currentLine) continue;
    const persisted = pastedLinePersistenceFields(match.incoming);
    const newName = incomingName(match.incoming);
    const edited = Boolean(currentLine.descriptionEditedByUser);
    const descChanged =
      currentLine.displayDescription.trim() !== newName.trim();
    const keepCurrentName =
      edited &&
      descChanged &&
      descriptionChoices[currentLine.id] !== "use_new";
    if (edited && descChanged) {
      descriptionConflicts.push({
        lineId: currentLine.id,
        currentName: currentLine.displayDescription,
        newName,
      });
    }
    const priceChanged = currentLine.totalCents !== match.incoming.totalCents;
    const qtyChanged =
      lineQuantity(currentLine.quantity) !== lineQuantity(match.incoming.quantity);
    const newQty = lineQuantity(match.incoming.quantity);
    const claimed = claimedQuantity(currentLine.claims ?? []);
    const claimedExceeds = claimed > newQty;
    const remaining = Math.max(0, newQty - claimed);
    const financial = priceChanged || qtyChanged;
    lines.push({
      action: match.action === "keep" && !descChanged ? "keep" : "update",
      currentId: currentLine.id,
      incomingIndex: match.incomingIndex,
      displayDescription: keepCurrentName
        ? currentLine.displayDescription
        : persisted.displayDescription,
      sourceText: persisted.sourceText,
      totalCents: match.incoming.totalCents,
      quantity: newQty,
      preserveDescription: keepCurrentName,
      financialReviewRequired: financial,
      claimReviewRequired: claimedExceeds,
      preserveClaims: !claimedExceeds,
      preserveAssignment: true,
      claimedQuantityExceedsNew: claimedExceeds,
      remainingUnclaimed: qtyChanged && newQty > claimed ? remaining : undefined,
    });
  }

  const unconfirmedRemovals = claimedRemovals.filter(
    (row) => !acceptedRemoved.has(row.lineId),
  );
  const reconCopy = recon.balanced
    ? null
    : `These numbers don't add up yet.\nDifference: ${formatUnaccounted(recon.unaccountedCents)}`;

  let applyBlockedReason: string | null = null;
  if (unconfirmedRemovals.length > 0) {
    applyBlockedReason = unconfirmedRemovals
      .map((row) => `${row.name} currently belongs to ${row.belongsTo}. This corrected receipt removes it.`)
      .join(" ");
  } else if (!recon.balanced && !choices.retainInvalidDraft) {
    applyBlockedReason = reconCopy;
  } else if (!finalized && !editable) {
    applyBlockedReason = "This receipt can no longer be re-pasted.";
  }

  const canActivate = applyBlockedReason == null && recon.balanced && editable && !finalized;
  const canStartCorrection =
    applyBlockedReason == null && recon.balanced && finalized;

  const notify =
    summary.financialChanged ||
    claimedRemovals.length > 0 ||
    lines.some((l) => l.claimReviewRequired);

  return {
    receiptId: current.receiptId,
    sameReceipt: true,
    editable,
    finalized,
    claimingActive,
    claimingWarning: claimingActive
      ? "Roommates may already be claiming items. Changes will be reviewed before applying."
      : null,
    rows,
    lines,
    matches,
    descriptionOnly: summary.descriptionOnly,
    financialChanged: summary.financialChanged,
    confirmationCopy: finalized
      ? "This starts a correction so the submitted expense stays on record until you confirm the update."
      : summary.financialChanged
        ? "This changes the receipt total or how item amounts are calculated. Review existing claims and assignments after applying it."
        : "Only item names changed. Existing assignments can be kept.",
    financialWarning: summary.financialChanged
      ? "This changes the receipt total or how item amounts are calculated. Review existing claims and assignments after applying it."
      : null,
    reconciliation: {
      balanced: recon.balanced,
      differenceCents: recon.unaccountedCents,
      copy: reconCopy,
    },
    claimedRemovals,
    descriptionConflicts,
    canActivate,
    canStartCorrection,
    applyBlockedReason,
    notify,
    header: {
      merchant: incoming.merchant,
      purchaseDate: incoming.purchaseDate,
      totalCents: incoming.totalCents,
      subtotalCents: incoming.subtotalCents,
      taxCents: incoming.taxCents,
      tipCents: incoming.tipCents,
      feeCents: incoming.feeCents,
      discountCents: incoming.discountCents,
    },
  };
}

function formatUnaccounted(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toFixed(2)}`;
}

export function serializeRepasteApplyPayload(
  plan: RepastePlan,
  acceptedRemovedClaimLineIds: string[] = [],
): {
  lines: Array<{
    action: string;
    id?: string;
    displayDescription: string;
    sourceText: string;
    totalCents: number;
    quantity: number;
    preserveDescription: boolean;
    financialReviewRequired: boolean;
    claimReviewRequired: boolean;
    preserveClaims: boolean;
    requiresRemovalConfirmation?: boolean;
    removalConfirmed?: boolean;
  }>;
  header: RepastePlan["header"];
  financialReviewRequired: boolean;
  notify: boolean;
  claimingActive: boolean;
} {
  const accepted = new Set(acceptedRemovedClaimLineIds);
  return {
    header: plan.header,
    financialReviewRequired: plan.financialChanged,
    notify: plan.notify,
    claimingActive: plan.claimingActive,
    lines: plan.lines.map((line) => ({
      action: line.action,
      id: line.currentId,
      displayDescription: line.displayDescription,
      sourceText: line.sourceText,
      totalCents: line.totalCents,
      quantity: line.quantity,
      preserveDescription: line.preserveDescription,
      financialReviewRequired: line.financialReviewRequired,
      claimReviewRequired: line.claimReviewRequired,
      preserveClaims: line.preserveClaims,
      requiresRemovalConfirmation: line.requiresRemovalConfirmation,
      removalConfirmed: Boolean(line.currentId && accepted.has(line.currentId)),
    })),
  };
}
