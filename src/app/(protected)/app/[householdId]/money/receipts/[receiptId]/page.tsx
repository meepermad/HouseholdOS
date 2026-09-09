import { assertActiveMembership } from "@/lib/household-context";
import { AppBackButton } from "@/components/app-back-button";
import { ResourceGone } from "@/components/recovery/resource-gone";
import {
  ReceiptReviewForm,
  type ReviewClaim,
  type ReviewInvite,
  type ReviewLineItem,
  type ReviewMember,
} from "@/components/receipts/ReceiptReviewForm";
import { describeReceiptOcrStatus } from "@/lib/receipts/adapters";
import type { LineItemClassification, ResourceDestination } from "@/lib/receipts/types";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import { receiptReviewFormKey } from "@/lib/receipts/review-identity";
import { mapPersistedLineToReview } from "@/lib/receipts/paste/review-lines";
import type { TranscriptionRevisionSummary } from "@/components/receipts/ReceiptRepastePanel";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;

export default async function ReceiptDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string; receiptId: string }>;
  searchParams: Promise<{ claim?: string }>;
}) {
  const { householdId, receiptId } = await params;
  const { claim } = await searchParams;
  const ctx = await assertActiveMembership(householdId);
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = (await createClient()) as UntypedDb;
  const members: ReviewMember[] = await listActiveMemberOptions(householdId);

  const { data: receipt } = await supabase
    .from("expense_receipts")
    .select("*")
    .eq("id", receiptId)
    .eq("household_id", householdId)
    .maybeSingle();

  if (!receipt) {
    return (
      <main className="space-y-4">
        <AppBackButton fallbackHref={`/app/${householdId}/money/receipts`} />
        <ResourceGone
          title="This item is no longer available."
          href={`/app/${householdId}/money`}
          actionLabel="Go to Money"
        />
      </main>
    );
  }

  const [{ data: lines }, { data: dup }, { data: extraction }, { data: inviteRows }, { data: claimRows }, revisionResult] =
    await Promise.all([
      supabase
        .from("expense_receipt_line_items")
        .select("*")
        .eq("receipt_id", receiptId)
        .order("sort_index"),
      supabase
        .from("expense_receipt_duplicates")
        .select("outcome")
        .eq("receipt_id", receiptId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("expense_receipt_extractions")
        .select("proposed, ocr_full_text, processing_meta")
        .eq("receipt_id", receiptId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("expense_receipt_claim_invites")
        .select("membership_id, status")
        .eq("receipt_id", receiptId),
      supabase
        .from("expense_receipt_line_claims")
        .select("line_item_id, membership_id, quantity, claim_kind")
        .eq("receipt_id", receiptId)
        .is("retracted_at", null),
      supabase
        .from("expense_receipt_transcription_revisions")
        .select("id, revision_number, created_at, reason, source_text, superseded_at")
        .eq("receipt_id", receiptId)
        .order("revision_number", { ascending: false }),
    ]);
  const revisionRows = Array.isArray(revisionResult?.data) ? revisionResult.data : [];

  const proposed = (extraction?.proposed ?? {}) as {
    taxCents?: number | null;
    tipCents?: number | null;
    discountCents?: number | null;
  };
  const taxCents = typeof proposed.taxCents === "number" ? proposed.taxCents : null;
  const tipCents = typeof proposed.tipCents === "number" ? proposed.tipCents : null;
  const discountCents =
    typeof proposed.discountCents === "number" ? proposed.discountCents : null;

  const ocr = describeReceiptOcrStatus();
  const pasted =
    receipt.intake_source === "paste" ||
    receipt.file_name?.startsWith("pasted-receipt") ||
    receipt.mime_type === "text/plain" ||
    (extraction?.processing_meta as { source?: string } | null)?.source === "paste";
  const reviewLines: ReviewLineItem[] = (lines ?? []).map(
    (l: {
      id: string;
      sort_index: number;
      ocr_text: string | null;
      corrected_name: string | null;
      source_text?: string | null;
      quantity: number | null;
      unit_price_cents: number | null;
      total_price_cents: number | null;
      classification: string;
      resource_destination: string;
      review_status: string;
      participant_membership_ids: string[] | null;
      description_edited_by_user?: boolean | null;
      description_source?: string | null;
      claim_review_required?: boolean | null;
    }) => {
      const mapped = mapPersistedLineToReview(
        {
          id: l.id,
          sortIndex: l.sort_index,
          ocr_text: l.ocr_text,
          corrected_name: l.corrected_name,
          source_text: l.source_text,
          quantity: l.quantity,
          unit_price_cents: l.unit_price_cents,
          total_price_cents: l.total_price_cents,
          classification: l.classification,
          participant_membership_ids: l.participant_membership_ids,
          description_edited_by_user: l.description_edited_by_user,
          description_source: l.description_source,
          claim_review_required: l.claim_review_required,
          review_status: l.review_status,
        },
        pasted,
      );
      return {
        id: l.id,
        sortIndex: l.sort_index,
        ocrText: mapped.sourceText,
        sourceText: mapped.sourceText,
        correctedName: mapped.correctedName,
        quantity: l.quantity,
        unitPriceCents: l.unit_price_cents,
        totalPriceCents: l.total_price_cents,
        classification: l.classification as LineItemClassification,
        resourceDestination: l.resource_destination as ResourceDestination,
        reviewStatus: l.review_status,
        participantMembershipIds: l.participant_membership_ids ?? [],
        descriptionEditedByUser: mapped.descriptionEditedByUser,
        claimReviewRequired: mapped.claimReviewRequired,
      };
    },
  );

  if (reviewLines.length === 0) {
    reviewLines.push({
      sortIndex: 0,
      ocrText: "",
      correctedName: "",
      quantity: 1,
      unitPriceCents: null,
      totalPriceCents: receipt.declared_total_cents,
      classification: "needs_review",
      resourceDestination: "none",
      reviewStatus: "pending",
      participantMembershipIds: [],
    });
  }

  const invites: ReviewInvite[] = (inviteRows ?? []).map(
    (i: { membership_id: string; status: ReviewInvite["status"] }) => ({
      membershipId: i.membership_id,
      status: i.status,
    }),
  );
  const claimList: ReviewClaim[] = (claimRows ?? []).map(
    (c: {
      line_item_id: string;
      membership_id: string;
      quantity: number;
      claim_kind: ReviewClaim["kind"];
    }) => ({
      lineItemId: c.line_item_id,
      membershipId: c.membership_id,
      quantity: Number(c.quantity) || 1,
      kind: c.claim_kind,
    }),
  );

  const yourClaims = claimList.filter((c) => c.membershipId === ctx.membershipId);
  const yourShareCents = yourClaims.reduce((sum, c) => {
    const line = reviewLines.find((l) => l.id === c.lineItemId);
    if (!line) return sum;
    const qty = line.quantity && line.quantity > 1 ? line.quantity : 1;
    return sum + Math.round(((line.totalPriceCents ?? 0) * c.quantity) / qty);
  }, 0);

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/money/receipts`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary">
          {receipt.status === "claiming" && ctx.membershipId !== receipt.payer_membership_id
            ? "Claim your items"
            : "Review receipt"}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {ocr.privacyLabel ?? ocr.message}
        </p>
        <div className="mt-3 rounded-md border border-border bg-surface p-3" data-testid="receipt-your-share">
          {ctx.membershipId === (receipt.payer_membership_id ?? receipt.uploaded_by_membership_id) ? (
            <>
              <p className="text-sm text-text-secondary">You paid</p>
              <p className="text-xl font-semibold tabular-nums">
                {((receipt.declared_total_cents ?? 0) / 100).toLocaleString(undefined, {
                  style: "currency",
                  currency: "USD",
                })}
              </p>
            </>
          ) : yourClaims.length === 0 ? (
            <>
              <p className="text-sm text-text-secondary">You have not claimed anything yet.</p>
              {receipt.status === "claiming" ? (
                <p className="text-sm font-medium text-primary">Select what is yours below.</p>
              ) : (
                <p className="text-sm text-text-secondary">Your items are waiting for payer review.</p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-text-secondary">Your share</p>
              <p className="text-xl font-semibold tabular-nums">
                {(yourShareCents / 100).toLocaleString(undefined, {
                  style: "currency",
                  currency: "USD",
                })}
              </p>
            </>
          )}
        </div>
      </header>
      {(receipt.status === "uploaded" || receipt.status === "extracting") && (
        <p className="text-sm text-text-muted" data-testid="receipt-processing">
          Reading is still in progress — you can enter details manually now.
        </p>
      )}
      <ReceiptReviewForm
        key={receiptReviewFormKey(receiptId)}
        householdId={householdId}
        receiptId={receiptId}
        merchant={receipt.merchant_corrected ?? ""}
        purchaseDate={
          receipt.purchase_date_corrected ??
          new Date().toISOString().slice(0, 10)
        }
        declaredTotalCents={receipt.declared_total_cents ?? 0}
        taxCents={taxCents}
        tipCents={tipCents}
        discountCents={discountCents}
        lineItems={reviewLines}
        duplicateOutcome={dup?.outcome ?? null}
        status={receipt.status}
        splitWorkflow={receipt.split_workflow ?? null}
        payerMembershipId={
          receipt.payer_membership_id ?? receipt.uploaded_by_membership_id
        }
        currentMembershipId={ctx.membershipId}
        members={members}
        invites={invites}
        claims={claimList}
        ocrOutcome={receipt.ocr_outcome ?? null}
        lastError={receipt.last_error ?? null}
        startInClaimMode={claim === "1" || receipt.status === "claiming"}
        intakeSource={pasted ? "paste" : receipt.intake_source === "camera" ? "camera" : "upload"}
        originalTranscription={
          (revisionRows ?? []).find((r: { superseded_at: string | null }) => r.superseded_at == null)
            ?.source_text ??
          (typeof extraction?.ocr_full_text === "string" ? extraction.ocr_full_text : null)
        }
        transcriptionCorrected={Boolean(receipt.transcription_corrected)}
        revisionCount={(revisionRows ?? []).length}
        revisions={((revisionRows ?? []) as Array<{
          id: string;
          revision_number: number;
          created_at: string;
          reason: "initial_paste" | "user_repaste";
          source_text: string;
          superseded_at: string | null;
        }>).map((r): TranscriptionRevisionSummary => ({
          id: r.id,
          revisionNumber: r.revision_number,
          createdAt: r.created_at,
          reason: r.reason,
          active: r.superseded_at == null,
          sourceText: r.source_text,
        }))}
        financialReviewRequired={Boolean(receipt.financial_review_required)}
        expenseId={receipt.expense_id ?? null}
      />
    </main>
  );
}
