import { resolvePastedDisplayDescription } from "./display-description";
import type { CurrentRepasteSnapshot } from "./repaste-plan";
import type { CurrentRepasteClaim, CurrentRepasteLine } from "./repaste-diff";

export type SnapshotMember = { id: string; label: string };

export function buildCurrentRepasteSnapshot(input: {
  receiptId: string;
  status: string;
  merchant: string | null;
  purchaseDate: string | null;
  totalCents: number | null;
  subtotalCents?: number | null;
  taxCents?: number | null;
  tipCents?: number | null;
  feeCents?: number | null;
  discountCents?: number | null;
  members: SnapshotMember[];
  lines: Array<{
    id: string;
    sortIndex: number;
    ocrText?: string | null;
    correctedName?: string | null;
    sourceText?: string | null;
    quantity: number | null;
    totalPriceCents: number | null;
    classification?: string | null;
    participantMembershipIds?: string[] | null;
    descriptionEditedByUser?: boolean | null;
  }>;
  claims: Array<{
    lineItemId: string;
    membershipId: string;
    quantity: number;
    kind: CurrentRepasteClaim["kind"];
  }>;
}): CurrentRepasteSnapshot {
  const members = new Map(input.members.map((m) => [m.id, m.label]));
  const lines: CurrentRepasteLine[] = input.lines.map((line) => {
    const lineClaims: CurrentRepasteClaim[] = input.claims
      .filter((c) => c.lineItemId === line.id)
      .map((c) => ({
        membershipId: c.membershipId,
        quantity: c.quantity,
        kind: c.kind,
        memberLabel: members.get(c.membershipId),
      }));
    return {
      id: line.id,
      sortIndex: line.sortIndex,
      displayDescription: resolvePastedDisplayDescription({
        correctedName: line.correctedName,
        sourceText: line.sourceText ?? line.ocrText,
        ocrText: line.ocrText,
        descriptionEditedByUser: line.descriptionEditedByUser ?? false,
      }),
      sourceText: line.sourceText ?? line.ocrText ?? "",
      totalCents: line.totalPriceCents ?? 0,
      quantity: line.quantity ?? 1,
      descriptionEditedByUser: line.descriptionEditedByUser ?? false,
      classification: line.classification ?? undefined,
      participantMembershipIds: line.participantMembershipIds ?? [],
      claims: lineClaims,
    };
  });
  return {
    receiptId: input.receiptId,
    status: input.status,
    merchant: input.merchant,
    purchaseDate: input.purchaseDate,
    totalCents: input.totalCents,
    subtotalCents: input.subtotalCents ?? null,
    taxCents: input.taxCents ?? null,
    tipCents: input.tipCents ?? null,
    feeCents: input.feeCents ?? null,
    discountCents: input.discountCents ?? null,
    lines,
  };
}
