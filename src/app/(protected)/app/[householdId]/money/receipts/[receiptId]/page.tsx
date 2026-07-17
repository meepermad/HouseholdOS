import { assertActiveMembership } from "@/lib/household-context";
import { AppBackButton } from "@/components/app-back-button";
import {
  ReceiptReviewForm,
  type ReviewLineItem,
} from "@/components/receipts/ReceiptReviewForm";
import { describeReceiptOcrStatus } from "@/lib/receipts/adapters";
import type { LineItemClassification, ResourceDestination } from "@/lib/receipts/types";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;

export default async function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ householdId: string; receiptId: string }>;
}) {
  const { householdId, receiptId } = await params;
  await assertActiveMembership(householdId);
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = (await createClient()) as UntypedDb;

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
        <p className="text-sm text-text-secondary">Receipt not found.</p>
      </main>
    );
  }

  const { data: lines } = await supabase
    .from("expense_receipt_line_items")
    .select("*")
    .eq("receipt_id", receiptId)
    .order("sort_index");

  const { data: dup } = await supabase
    .from("expense_receipt_duplicates")
    .select("outcome")
    .eq("receipt_id", receiptId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ocr = describeReceiptOcrStatus();
  const reviewLines: ReviewLineItem[] = (lines ?? []).map(
    (l: {
      id: string;
      sort_index: number;
      ocr_text: string | null;
      corrected_name: string | null;
      quantity: number | null;
      unit_price_cents: number | null;
      total_price_cents: number | null;
      classification: string;
      resource_destination: string;
      review_status: string;
      participant_membership_ids: string[] | null;
    }) => ({
      id: l.id,
      sortIndex: l.sort_index,
      ocrText: l.ocr_text ?? "",
      correctedName: l.corrected_name ?? l.ocr_text ?? "",
      quantity: l.quantity,
      unitPriceCents: l.unit_price_cents,
      totalPriceCents: l.total_price_cents,
      classification: l.classification as LineItemClassification,
      resourceDestination: l.resource_destination as ResourceDestination,
      reviewStatus: l.review_status,
      participantMembershipIds: l.participant_membership_ids ?? [],
    }),
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

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/money/receipts`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary">
          Review receipt
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Status: {receipt.status}. {ocr.privacyLabel ?? ocr.message}
        </p>
      </header>
      {(receipt.status === "uploaded" || receipt.status === "extracting") && (
        <p className="text-sm text-text-muted" data-testid="receipt-processing">
          Extraction pending — you can enter details manually now.
        </p>
      )}
      <ReceiptReviewForm
        householdId={householdId}
        receiptId={receiptId}
        merchant={receipt.merchant_corrected ?? ""}
        purchaseDate={
          receipt.purchase_date_corrected ??
          new Date().toISOString().slice(0, 10)
        }
        declaredTotalCents={receipt.declared_total_cents ?? 0}
        lineItems={reviewLines}
        duplicateOutcome={dup?.outcome ?? null}
        status={receipt.status}
      />
    </main>
  );
}
