"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/app/actions/auth";
import { assertActiveMembership } from "@/lib/household-context";
import { logServerError, toPublicErrorMessage } from "@/lib/errors";
import {
  RECEIPT_BUCKET,
} from "@/lib/receipts/types";
import {
  validateReceiptUpload,
} from "@/lib/receipts/validate";
import { detectDuplicateReceipts } from "@/lib/receipts/duplicates";
import { describeReceiptOcrStatus } from "@/lib/receipts/adapters";
import { mapReceiptUploadFailure } from "@/lib/receipts/upload-errors";

async function db(householdId: string) {
  const ctx = await assertActiveMembership(householdId);
  const { createClient } = await import("@/lib/supabase/server");
  return { ctx, supabase: await createClient() };
}

function invalidate(householdId: string, receiptId?: string) {
  revalidatePath(`/app/${householdId}/money`);
  revalidatePath(`/app/${householdId}/money/receipts`);
  if (receiptId) {
    revalidatePath(`/app/${householdId}/money/receipts/${receiptId}`);
  }
}

export async function getReceiptOcrStatusAction(): Promise<{
  configured: boolean;
  provider: string;
  message: string;
}> {
  return describeReceiptOcrStatus();
}

export async function uploadReceiptAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose a receipt photo or PDF." };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const validation = validateReceiptUpload({
      mimeType: file.type || "application/octet-stream",
      fileName: file.name,
      sizeBytes: file.size,
      bytes,
    });
    if (!validation.ok) return { ok: false, error: validation.error };

    const fileHash = createHash("sha256").update(bytes).digest("hex");
    const idempotencyKey =
      String(formData.get("idempotencyKey") ?? "").trim() || randomUUID();
    const { ctx, supabase } = await db(householdId);

    const { data: existing } = await supabase
      .from("expense_receipts")
      .select("id, file_hash, perceptual_hash, merchant_corrected, purchase_date_corrected, declared_total_cents, expense_id")
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .limit(50);

    const storagePath = `${householdId}/uploads/${idempotencyKey}.${validation.extension}`;

    const { error: uploadError } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .upload(storagePath, bytes, {
        contentType: validation.mimeType,
        upsert: true,
      });
    if (uploadError) {
      logServerError("receipts.upload.storage", uploadError, { householdId });
      return {
        ok: false,
        error: mapReceiptUploadFailure({
          stage: "storage_upload",
          raw: uploadError.message,
        }).message,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: id, error } = await (supabase as any).rpc("register_expense_receipt", {
      p_household_id: householdId,
      p_storage_path: storagePath,
      p_mime_type: validation.mimeType,
      p_file_name: file.name,
      p_size_bytes: file.size,
      p_file_hash: fileHash,
      p_perceptual_hash: undefined,
      p_idempotency_key: idempotencyKey,
    });
    if (error) {
      const { error: removeError } = await supabase.storage
        .from(RECEIPT_BUCKET)
        .remove([storagePath]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc("record_receipt_orphan_cleanup", {
        p_household_id: householdId,
        p_storage_path: storagePath,
        p_reason: removeError ? "registration_failed_cleanup_failed" : "registration_failed_cleaned",
        p_cleaned: !removeError,
      });
      if (removeError) {
        logServerError("receipts.upload.orphan", removeError, { householdId });
      }
      return {
        ok: false,
        error: mapReceiptUploadFailure({
          stage: "registration",
          raw: error.message,
        }).message,
      };
    }

    const dup = detectDuplicateReceipts(
      {
        id: String(id),
        fileHash,
        perceptualHash: null,
        merchant: null,
        purchaseDate: null,
        totalCents: null,
        contentHash: null,
        expenseId: null,
      },
      (existing ?? []).map((r: {
        id: string;
        file_hash: string | null;
        perceptual_hash: string | null;
        merchant_corrected: string | null;
        purchase_date_corrected: string | null;
        declared_total_cents: number | null;
        expense_id: string | null;
      }) => ({
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

    void ctx;
    invalidate(householdId, String(id));
    const redirectTo = `/app/${householdId}/money/receipts/${id}`;
    if (dup.outcome !== "none") {
      return {
        ok: true,
        message: `Receipt uploaded. Possible duplicate detected (${dup.outcome}).`,
        data: { redirectTo, receiptId: String(id), duplicateOutcome: dup.outcome },
      };
    }
    return {
      ok: true,
      message: "Receipt uploaded.",
      data: { redirectTo, receiptId: String(id) },
    };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function updateReceiptReviewAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const receiptId = String(formData.get("receiptId") ?? "");
    const merchant = String(formData.get("merchant") ?? "").trim() || null;
    const purchaseDate = String(formData.get("purchaseDate") ?? "").trim() || null;
    const totalRaw = String(formData.get("declaredTotalCents") ?? "").trim();
    const declaredTotalCents = totalRaw ? Number(totalRaw) : null;
    const lineItemsJson = String(formData.get("lineItemsJson") ?? "null");
    let lineItems = null;
    try {
      lineItems = JSON.parse(lineItemsJson);
    } catch {
      lineItems = null;
    }

    const { supabase } = await db(householdId);
    const { error } = await supabase.rpc("update_receipt_review", {
      p_receipt_id: receiptId,
      p_merchant: merchant ?? undefined,
      p_purchase_date: purchaseDate ?? undefined,
      p_declared_total_cents: declaredTotalCents ?? undefined,
      p_currency: "USD",
      p_notes: undefined,
      p_line_items: lineItems ?? undefined,
    });
    if (error) {
      return {
        ok: false,
        error: mapReceiptRpcError(error.message),
      };
    }
    invalidate(householdId, receiptId);
    return { ok: true, message: "Receipt review saved." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function confirmReceiptAsExpenseAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const receiptId = String(formData.get("receiptId") ?? "");
    const idempotencyKey =
      String(formData.get("idempotencyKey") ?? "").trim() || randomUUID();
    const { supabase } = await db(householdId);
    const { data: expenseId, error } = await supabase.rpc(
      "confirm_receipt_as_expense",
      {
        p_receipt_id: receiptId,
        p_idempotency_key: idempotencyKey,
      },
    );
    if (error) {
      return { ok: false, error: mapReceiptRpcError(error.message) };
    }
    invalidate(householdId, receiptId);
    // Inventory / pantry destinations are an optional follow-up, not part of
    // creating the expense.
    redirect(
      `/app/${householdId}/money/expenses/${expenseId}?fromReceipt=1`,
    );
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

/** Submit on-device OCR proposal after upload (local_tesseract). */
export async function submitLocalReceiptExtractionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const receiptId = String(formData.get("receiptId") ?? "");
    const proposedJson = String(formData.get("proposedJson") ?? "{}");
    const lineItemsJson = String(formData.get("lineItemsJson") ?? "[]");
    const contentHash = String(formData.get("contentHash") ?? "");
    const confidenceRaw = String(formData.get("confidence") ?? "");
    const ocrFullText = String(formData.get("ocrFullText") ?? "") || null;
    const ocrLinesJson = String(formData.get("ocrLinesJson") ?? "") || null;
    const processingMetaJson = String(formData.get("processingMetaJson") ?? "") || null;
    const adapterName =
      String(formData.get("adapterName") ?? "local_tesseract").trim() ||
      "local_tesseract";

    let proposed: Record<string, unknown> = {};
    let lineItems: unknown[] = [];
    let ocrLines: unknown = null;
    let processingMeta: unknown = null;
    try {
      proposed = JSON.parse(proposedJson) as Record<string, unknown>;
    } catch {
      return { ok: false, error: "Invalid extraction payload." };
    }
    try {
      lineItems = JSON.parse(lineItemsJson) as unknown[];
    } catch {
      return { ok: false, error: "Invalid line items payload." };
    }
    if (ocrLinesJson) {
      try {
        ocrLines = JSON.parse(ocrLinesJson);
      } catch {
        ocrLines = null;
      }
    }
    if (processingMetaJson) {
      try {
        processingMeta = JSON.parse(processingMetaJson);
      } catch {
        processingMeta = null;
      }
    }

    const { supabase } = await db(householdId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("submit_client_receipt_extraction", {
      p_receipt_id: receiptId,
      p_adapter_name: adapterName,
      p_confidence: confidenceRaw ? Number(confidenceRaw) : 0,
      p_proposed: proposed,
      p_content_hash: contentHash,
      p_line_items: lineItems,
      p_ocr_full_text: ocrFullText ?? undefined,
      p_ocr_lines_json: ocrLines ?? undefined,
      p_processing_meta: processingMeta ?? undefined,
    });
    if (error) return { ok: false, error: mapReceiptRpcError(error.message) };
    invalidate(householdId, receiptId);
    return { ok: true, message: "On-device extraction saved for review." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function upsertReceiptAliasAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const kind = String(formData.get("kind") ?? "").trim();
    const sourceText = String(formData.get("sourceText") ?? "").trim();
    const targetText = String(formData.get("targetText") ?? "").trim();
    const merchantScope =
      String(formData.get("merchantScope") ?? "").trim() || null;
    if (!kind || !sourceText || !targetText) {
      return { ok: false, error: "Alias requires source and target text." };
    }
    const { supabase } = await db(householdId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("upsert_receipt_alias", {
      p_household_id: householdId,
      p_kind: kind,
      p_source_text: sourceText,
      p_target_text: targetText,
      p_merchant_scope: merchantScope ?? undefined,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(householdId);
    return { ok: true, message: "Alias saved for this household." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

function mapReceiptRpcError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("claim_conflict")) return "Someone else already claimed this item.";
  if (m.includes("claim_overclaim")) return "That would claim more than is left on this item.";
  if (m.includes("claim_finalized")) return "This receipt is already submitted.";
  if (m.includes("claim_not_open")) return "This receipt is not open for claiming.";
  if (m.includes("not authenticated") || m.includes("jwt")) {
    return mapReceiptUploadFailure({ raw: message }).message;
  }
  if (m.includes("not authorized") || m.includes("not an active")) {
    return "You cannot change this receipt.";
  }
  if (m.includes("waiting_for_claims")) {
    return "Some roommates have not claimed yet. Finish now if you want to continue without them.";
  }
  return "Could not update this receipt. Try again.";
}

export async function markReceiptOcrOutcomeAction(
  householdId: string,
  receiptId: string,
  outcome: "pending" | "succeeded" | "failed" | "manual" | "timeout",
): Promise<ActionResult> {
  try {
    const { supabase } = await db(householdId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("mark_receipt_ocr_outcome", {
      p_receipt_id: receiptId,
      p_outcome: outcome,
    });
    if (error) return { ok: false, error: mapReceiptRpcError(error.message) };
    invalidate(householdId, receiptId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function startReceiptClaimingAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const receiptId = String(formData.get("receiptId") ?? "");
    const waitMode = String(formData.get("waitMode") ?? "wait_for_everyone");
    const { supabase } = await db(householdId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("start_receipt_claiming", {
      p_receipt_id: receiptId,
      p_wait_mode: waitMode,
    });
    if (error) return { ok: false, error: mapReceiptRpcError(error.message) };
    invalidate(householdId, receiptId);
    return { ok: true, message: "Roommates can now claim their items." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function setReceiptSplitWorkflowAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const receiptId = String(formData.get("receiptId") ?? "");
    const workflow = String(formData.get("workflow") ?? "");
    const membershipIds = String(formData.get("membershipIds") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const payerMembershipId = String(formData.get("payerMembershipId") ?? "").trim();
    const { supabase } = await db(householdId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("set_receipt_split_workflow", {
      p_receipt_id: receiptId,
      p_workflow: workflow,
      p_membership_ids: membershipIds.length ? membershipIds : undefined,
      p_payer_membership_id: payerMembershipId || undefined,
    });
    if (error) return { ok: false, error: mapReceiptRpcError(error.message) };
    if (workflow === "claiming") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: startError } = await (supabase as any).rpc("start_receipt_claiming", {
        p_receipt_id: receiptId,
        p_invite_membership_ids: membershipIds.length ? membershipIds : undefined,
      });
      if (startError) return { ok: false, error: mapReceiptRpcError(startError.message) };
    }
    invalidate(householdId, receiptId);
    return { ok: true, message: "Split updated." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function claimReceiptLinesAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const lineIds = String(formData.get("lineIds") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const quantitiesRaw = String(formData.get("quantities") ?? "");
    const quantities = quantitiesRaw
      ? quantitiesRaw.split(",").map((s) => Number(s) || 1)
      : lineIds.map(() => 1);
    if (lineIds.length === 0) {
      return { ok: false, error: "Select at least one item." };
    }
    const { supabase } = await db(householdId);
    for (let i = 0; i < lineIds.length; i += 1) {
      const qty = quantities[i] ?? 1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("claim_receipt_line_quantity", {
        p_line_item_id: lineIds[i],
        p_quantity: qty,
        p_idempotency_key: `${lineIds[i]}:${qty}:${String(formData.get("idempotencyKey") ?? randomUUID())}`,
      });
      if (error) return { ok: false, error: mapReceiptRpcError(error.message) };
    }
    invalidate(householdId);
    return { ok: true, message: "Items claimed." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function unclaimReceiptLineAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const lineId = String(formData.get("lineId") ?? "");
    const { supabase } = await db(householdId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("unclaim_receipt_line", {
      p_line_item_id: lineId,
    });
    if (error) return { ok: false, error: mapReceiptRpcError(error.message) };
    invalidate(householdId);
    return { ok: true, message: "Item unclaimed." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function markReceiptLineSharedAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const lineId = String(formData.get("lineId") ?? "");
    const membershipIds = String(formData.get("membershipIds") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const { supabase } = await db(householdId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("mark_receipt_line_shared", {
      p_line_item_id: lineId,
      p_membership_ids: membershipIds.length ? membershipIds : undefined,
    });
    if (error) return { ok: false, error: mapReceiptRpcError(error.message) };
    invalidate(householdId);
    return { ok: true, message: "Item marked shared." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function assignReceiptLineAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const lineId = String(formData.get("lineId") ?? "");
    const membershipId = String(formData.get("membershipId") ?? "");
    const excluded = String(formData.get("excluded") ?? "") === "1";
    const { supabase } = await db(householdId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("assign_receipt_line", {
      p_line_item_id: lineId,
      p_membership_id: membershipId || undefined,
      p_excluded: excluded,
    });
    if (error) return { ok: false, error: mapReceiptRpcError(error.message) };
    invalidate(householdId);
    return { ok: true, message: excluded ? "Item excluded." : "Item assigned." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function applyRemainingReceiptLinesAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const receiptId = String(formData.get("receiptId") ?? "");
    const action = String(formData.get("remainingAction") ?? "");
    const { supabase } = await db(householdId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("apply_remaining_receipt_lines", {
      p_receipt_id: receiptId,
      p_action: action,
    });
    if (error) return { ok: false, error: mapReceiptRpcError(error.message) };
    invalidate(householdId, receiptId);
    return { ok: true, message: "Remaining items updated." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function finishReceiptClaimingAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const receiptId = String(formData.get("receiptId") ?? "");
    const { supabase } = await db(householdId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("finish_receipt_claiming", {
      p_receipt_id: receiptId,
    });
    if (error) return { ok: false, error: mapReceiptRpcError(error.message) };
    invalidate(householdId, receiptId);
    return { ok: true, message: "Thanks — your claims were saved." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function finalizeReceiptClaimsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const receiptId = String(formData.get("receiptId") ?? "");
    const force = String(formData.get("force") ?? "") === "1";
    const { supabase } = await db(householdId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("finalize_receipt_claims", {
      p_receipt_id: receiptId,
      p_force: force,
    });
    if (error) return { ok: false, error: mapReceiptRpcError(error.message) };
    invalidate(householdId, receiptId);
    return { ok: true, message: "Ready to review the split." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function remindReceiptClaimingAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const receiptId = String(formData.get("receiptId") ?? "");
    const { supabase } = await db(householdId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("remind_receipt_claiming", {
      p_receipt_id: receiptId,
    });
    if (error) return { ok: false, error: mapReceiptRpcError(error.message) };
    return { ok: true, message: "Reminder sent." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function deleteReceiptAliasAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const aliasId = String(formData.get("aliasId") ?? "");
    const { supabase } = await db(householdId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("delete_receipt_alias", {
      p_alias_id: aliasId,
    });
    if (error) return { ok: false, error: error.message };
    invalidate(householdId);
    return { ok: true, message: "Alias deleted." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}
