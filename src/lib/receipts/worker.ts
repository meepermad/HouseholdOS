import "server-only";

import { resolveReceiptExtractionAdapter } from "./adapters";
import { detectDuplicateReceipts } from "./duplicates";
import { maskPaymentInfo } from "./mask-payment";

/**
 * Claim and process receipt OCR jobs (privileged client).
 */
export async function processReceiptExtractionJobs(options?: {
  batchSize?: number;
}): Promise<{ claimed: number; succeeded: number; failed: number; manual: number }> {
  const { createPrivilegedClient } = await import("@/lib/supabase/privileged");
  const supabase = await createPrivilegedClient();
  const adapter = resolveReceiptExtractionAdapter();

  const { data: jobs, error } = await supabase.rpc("claim_receipt_extraction_jobs", {
    p_batch_size: options?.batchSize ?? 5,
  });
  if (error || !jobs?.length) {
    return { claimed: 0, succeeded: 0, failed: 0, manual: 0 };
  }

  let succeeded = 0;
  let failed = 0;
  let manual = 0;

  for (const job of jobs as Array<{
    id: string;
    receipt_id: string;
    household_id: string;
  }>) {
    const { data: receipt } = await supabase
      .from("expense_receipts")
      .select("*")
      .eq("id", job.receipt_id)
      .single();

    if (!receipt) {
      failed += 1;
      continue;
    }

    await supabase
      .from("expense_receipts")
      .update({ status: "extracting" })
      .eq("id", receipt.id);

    // Local OCR runs in the browser — never download/send to a cloud provider.
    if (adapter.name === "local_tesseract") {
      await supabase.rpc("complete_receipt_extraction", {
        p_receipt_id: receipt.id,
        p_adapter_name: adapter.name,
        p_confidence: 0,
        p_proposed: {},
        p_content_hash: "",
        p_line_items: [],
        p_configured: false,
        p_error:
          "Local OCR is device-side. Enter manually or submit on-device extraction.",
      });
      manual += 1;
      continue;
    }

    const { data: file } = await supabase.storage
      .from("expense-receipts")
      .download(receipt.storage_path);

    if (!file) {
      await supabase.rpc("complete_receipt_extraction", {
        p_receipt_id: receipt.id,
        p_adapter_name: adapter.name,
        p_confidence: 0,
        p_proposed: {},
        p_content_hash: "",
        p_line_items: [],
        p_configured: adapter.configured,
        p_error: "Could not download receipt",
      });
      failed += 1;
      continue;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await adapter.extract({
      mimeType: receipt.mime_type,
      fileName: receipt.file_name,
      bytes,
      householdId: receipt.household_id,
      receiptId: receipt.id,
    });

    if (!result.ok) {
      await supabase.rpc("complete_receipt_extraction", {
        p_receipt_id: receipt.id,
        p_adapter_name: result.adapter,
        p_confidence: 0,
        p_proposed: {},
        p_content_hash: "",
        p_line_items: [],
        p_configured: result.configured,
        p_error: result.error,
      });
      if (!result.configured) manual += 1;
      else failed += 1;
      continue;
    }

    const extraction = result.extraction;
    extraction.paymentMethodSummary = maskPaymentInfo(
      extraction.paymentMethodSummary,
    );

    const { data: existing } = await supabase
      .from("expense_receipts")
      .select(
        "id, file_hash, perceptual_hash, merchant_corrected, purchase_date_corrected, declared_total_cents, expense_id",
      )
      .eq("household_id", receipt.household_id)
      .is("deleted_at", null)
      .neq("id", receipt.id)
      .limit(50);

    const dup = detectDuplicateReceipts(
      {
        id: receipt.id,
        fileHash: receipt.file_hash,
        perceptualHash: receipt.perceptual_hash,
        merchant: extraction.merchant,
        purchaseDate: extraction.purchaseDate,
        totalCents: extraction.totalCents,
        contentHash: extraction.contentHash,
        expenseId: null,
      },
      (existing ?? []).map((r) => ({
        id: r.id,
        fileHash: r.file_hash,
        perceptualHash: r.perceptual_hash,
        merchant: r.merchant_corrected,
        purchaseDate: r.purchase_date_corrected,
        totalCents: r.declared_total_cents,
        contentHash: null,
        expenseId: r.expense_id,
      })),
    );

    await supabase.rpc("complete_receipt_extraction", {
      p_receipt_id: receipt.id,
      p_adapter_name: result.adapter,
      p_confidence: extraction.confidence ?? 0,
      p_proposed: {
        merchant: extraction.merchant,
        purchaseDate: extraction.purchaseDate,
        subtotalCents: extraction.subtotalCents,
        taxCents: extraction.taxCents,
        tipCents: extraction.tipCents,
        totalCents: extraction.totalCents,
        currency: extraction.currency,
        paymentMethodSummary: extraction.paymentMethodSummary,
      },
      p_content_hash: extraction.contentHash ?? "",
      p_line_items: extraction.lineItems.map((li) => ({
        ocrText: li.ocrText,
        name: li.name,
        quantity: li.quantity,
        unitPriceCents: li.unitPriceCents,
        totalPriceCents: li.totalPriceCents,
        confidence: li.confidence,
      })),
      p_duplicate_outcome: dup.outcome,
      p_duplicate_signals: dup.signals,
      p_match_receipt_id: dup.matchReceiptId ?? undefined,
      p_match_expense_id: dup.matchExpenseId ?? undefined,
      p_configured: true,
    });
    succeeded += 1;
  }

  return { claimed: jobs.length, succeeded, failed, manual };
}
