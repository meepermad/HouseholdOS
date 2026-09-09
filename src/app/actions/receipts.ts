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
import { mapReceiptUploadFailure, receiptUploadUserMessage } from "@/lib/receipts/upload-errors";
import { loginUrlForPath, receiptCaptureReturnPath } from "@/lib/auth/login-next";
import { isNextRedirectError } from "@/lib/navigation-errors";
import {
  isMembershipUuid,
  mapReceiptRpcError,
  parseMembershipIdList,
  SHARE_NEEDS_PERSON,
} from "@/lib/receipts/errors";
import { applyPasteEdits, type PasteEditInput } from "@/lib/receipts/paste/overrides";
import {
  parseHouseholdOsReceipt,
  userFacingPasteError,
} from "@/lib/receipts/paste/parse";
import { pastedReceiptToExtraction } from "@/lib/receipts/paste/to-extraction";
import {
  buildRepastePlan,
  serializeRepasteApplyPayload,
  type DescriptionChoice,
} from "@/lib/receipts/paste/repaste-plan";
import { isReceiptRepasteEditable } from "@/lib/receipts/paste/display-description";
import { buildCurrentRepasteSnapshot } from "@/lib/receipts/paste/snapshot";
import { listActiveMemberOptions } from "@/lib/expenses/queries";

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
  const householdId = String(formData.get("householdId") ?? "");
  try {
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
    if (isNextRedirectError(e)) {
      const next = householdId
        ? receiptCaptureReturnPath(householdId)
        : "/app";
      return {
        ok: false,
        error: receiptUploadUserMessage("session_expired"),
        actionHref: loginUrlForPath(next, "session_expired"),
        actionLabel: "Sign in again",
      };
    }
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

function isReusablePasteObjectError(message: string | undefined): boolean {
  return /already exists|duplicate|the resource already exists/i.test(message ?? "");
}

/**
 * Create a receipt draft from pasted text and persist it through the same
 * extraction / review / claim pipeline as an uploaded photo.
 */
export async function registerPastedReceiptAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const householdId = String(formData.get("householdId") ?? "");
  try {
    const originalText = String(formData.get("originalText") ?? "");
    const acceptQuick = String(formData.get("acceptQuick") ?? "") === "1";
    const totalOnly = String(formData.get("totalOnly") ?? "") === "1";
    const idempotencyKey =
      String(formData.get("idempotencyKey") ?? "").trim() || randomUUID();
    let edit: PasteEditInput | null = null;
    const editRaw = String(formData.get("editJson") ?? "").trim();
    if (editRaw) {
      try {
        edit = JSON.parse(editRaw) as PasteEditInput;
      } catch {
        return { ok: false, error: "We could not save those receipt edits." };
      }
    }

    const members = await listActiveMemberOptions(householdId);
    const parsed = parseHouseholdOsReceipt(originalText, members);
    if (
      parsed.problems.some(
        (p) => p.code === "unknown_format" || p.code === "overflow_amount" || p.code === "too_large",
      )
    ) {
      return {
        ok: false,
        error: userFacingPasteError(parsed.problems, parsed.ok ? null : parsed.error),
      };
    }
    const base =
      parsed.ok
        ? parsed.receipt
        : acceptQuick && parsed.quickCandidate
          ? parsed.quickCandidate
          : parsed.receipt;
    if (!base) {
      return {
        ok: false,
        error: userFacingPasteError(
          parsed.problems,
          parsed.ok ? null : parsed.error,
        ),
      };
    }
    const applied = applyPasteEdits(base, { ...edit, totalOnly: totalOnly || edit?.totalOnly });
    if ("error" in applied) return { ok: false, error: applied.error };
    if (!applied.merchant || applied.totalCents == null) {
      return { ok: false, error: "This receipt still needs a store name and total." };
    }

    const extraction = pastedReceiptToExtraction(applied);
    const textBytes = new TextEncoder().encode(applied.originalText.slice(0, 50_000));
    const fileHash = createHash("sha256").update(textBytes).digest("hex");
    const { supabase } = await db(householdId);

    // Insert only. upsert:true hits the storage UPDATE policy, which requires an
    // existing receipt row, so first-time pastes fail RLS. Do not send charset
    // (the bucket allowlist is exact `text/plain`) and do not substitute a PNG.
    const storagePath = `${householdId}/pastes/${idempotencyKey}.txt`;
    const mimeType = "text/plain";
    const fileName = "pasted-receipt.txt";
    const sizeBytes = textBytes.byteLength || 1;
    const uploaded = await supabase.storage.from(RECEIPT_BUCKET).upload(storagePath, textBytes, {
      contentType: "text/plain",
      upsert: false,
    });
    if (uploaded.error && !isReusablePasteObjectError(uploaded.error.message)) {
      logServerError("receipts.paste.storage", uploaded.error, { householdId });
      return { ok: false, error: "Could not save the pasted receipt. Try again." };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let registered = await (supabase as any).rpc("register_pasted_receipt", {
      p_household_id: householdId,
      p_storage_path: storagePath,
      p_mime_type: mimeType,
      p_file_name: fileName,
      p_size_bytes: sizeBytes,
      p_file_hash: fileHash,
      p_idempotency_key: idempotencyKey,
      p_payer_membership_id: applied.payerMembershipId,
    });
    if (registered.error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      registered = await (supabase as any).rpc("register_expense_receipt", {
        p_household_id: householdId,
        p_storage_path: storagePath,
        p_mime_type: mimeType,
        p_file_name: fileName,
        p_size_bytes: sizeBytes,
        p_file_hash: fileHash,
        p_perceptual_hash: undefined,
        p_idempotency_key: idempotencyKey,
      });
    }
    if (registered.error || !registered.data) {
      await supabase.storage.from(RECEIPT_BUCKET).remove([storagePath]);
      return {
        ok: false,
        error: mapReceiptRpcError(registered.error?.message ?? "Could not save this receipt."),
      };
    }

    const receiptId = String(registered.data);
    const extractFd = new FormData();
    extractFd.set("householdId", householdId);
    extractFd.set("receiptId", receiptId);
    extractFd.set("adapterName", "manual");
    extractFd.set("confidence", "1");
    extractFd.set("contentHash", extraction.contentHash);
    extractFd.set("proposedJson", JSON.stringify(extraction.proposed));
    extractFd.set("lineItemsJson", JSON.stringify(extraction.lineItems));
    extractFd.set("ocrFullText", applied.originalText.slice(0, 50_000));
    extractFd.set(
      "processingMetaJson",
      JSON.stringify(extraction.processingMeta),
    );
    const saved = await submitLocalReceiptExtractionAction(null, extractFd);
    if (!saved.ok) return saved;

    invalidate(householdId, receiptId);
    return {
      ok: true,
      message: "Receipt ready to review.",
      data: {
        redirectTo: `/app/${householdId}/money/receipts/${receiptId}`,
        receiptId,
      },
    };
  } catch (e) {
    if (isNextRedirectError(e)) {
      const next = householdId
        ? receiptCaptureReturnPath(householdId, "paste")
        : "/app";
      return {
        ok: false,
        error: receiptUploadUserMessage("session_expired"),
        actionHref: loginUrlForPath(next, "session_expired"),
        actionLabel: "Sign in again",
      };
    }
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

function validMembershipIds(raw: string): string[] | { error: string } {
  const ids = parseMembershipIdList(raw);
  if (ids.some((id) => !isMembershipUuid(id))) {
    return { error: SHARE_NEEDS_PERSON };
  }
  return ids;
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
    const membershipIdsOrError = validMembershipIds(
      String(formData.get("membershipIds") ?? ""),
    );
    if (!Array.isArray(membershipIdsOrError)) {
      return { ok: false, error: membershipIdsOrError.error };
    }
    const membershipIds = membershipIdsOrError;
    if (workflow === "equal_all" && formData.has("membershipIds") && membershipIds.length === 0) {
      return { ok: false, error: SHARE_NEEDS_PERSON };
    }
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
    const membershipIdsOrError = validMembershipIds(
      String(formData.get("membershipIds") ?? ""),
    );
    if (!Array.isArray(membershipIdsOrError)) {
      return { ok: false, error: membershipIdsOrError.error };
    }
    const membershipIds = membershipIdsOrError;
    if (formData.has("membershipIds") && membershipIds.length === 0) {
      return { ok: false, error: SHARE_NEEDS_PERSON };
    }
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

export type RepastePreviewActionResult =
  | { ok: true; previewJson: string }
  | { ok: false; error: string };

async function loadReceiptRepasteSnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  householdId: string,
  receiptId: string,
) {
  const members = await listActiveMemberOptions(householdId);
  const [{ data: receipt }, { data: lines }, { data: claimRows }, { data: extraction }] =
    await Promise.all([
      supabase
        .from("expense_receipts")
        .select(
          "id, status, merchant_corrected, purchase_date_corrected, declared_total_cents, intake_source, expense_id",
        )
        .eq("id", receiptId)
        .eq("household_id", householdId)
        .maybeSingle(),
      supabase
        .from("expense_receipt_line_items")
        .select(
          "id, sort_index, ocr_text, corrected_name, source_text, quantity, total_price_cents, classification, participant_membership_ids, description_edited_by_user",
        )
        .eq("receipt_id", receiptId)
        .order("sort_index"),
      supabase
        .from("expense_receipt_line_claims")
        .select("line_item_id, membership_id, quantity, claim_kind")
        .eq("receipt_id", receiptId)
        .is("retracted_at", null),
      supabase
        .from("expense_receipt_extractions")
        .select("proposed")
        .eq("receipt_id", receiptId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  if (!receipt) return { ok: false as const, error: "Receipt not found." };
  const proposed = (extraction?.proposed ?? {}) as {
    subtotalCents?: number | null;
    taxCents?: number | null;
    tipCents?: number | null;
    feeCents?: number | null;
    discountCents?: number | null;
  };
  const snapshot = buildCurrentRepasteSnapshot({
    receiptId,
    status: receipt.status,
    merchant: receipt.merchant_corrected,
    purchaseDate: receipt.purchase_date_corrected,
    totalCents: receipt.declared_total_cents,
    subtotalCents: proposed.subtotalCents ?? null,
    taxCents: proposed.taxCents ?? null,
    tipCents: proposed.tipCents ?? null,
    feeCents: proposed.feeCents ?? null,
    discountCents: proposed.discountCents ?? null,
    members,
    lines: (lines ?? []).map(
      (l: {
        id: string;
        sort_index: number;
        ocr_text: string | null;
        corrected_name: string | null;
        source_text: string | null;
        quantity: number | null;
        total_price_cents: number | null;
        classification: string | null;
        participant_membership_ids: string[] | null;
        description_edited_by_user: boolean | null;
      }) => ({
        id: l.id,
        sortIndex: l.sort_index,
        ocrText: l.ocr_text,
        correctedName: l.corrected_name,
        sourceText: l.source_text,
        quantity: l.quantity,
        totalPriceCents: l.total_price_cents,
        classification: l.classification,
        participantMembershipIds: l.participant_membership_ids,
        descriptionEditedByUser: l.description_edited_by_user,
      }),
    ),
    claims: (claimRows ?? []).map(
      (c: {
        line_item_id: string;
        membership_id: string;
        quantity: number;
        claim_kind: "mine" | "assigned" | "shared" | "household" | "excluded" | "quantity";
      }) => ({
        lineItemId: c.line_item_id,
        membershipId: c.membership_id,
        quantity: Number(c.quantity) || 1,
        kind: c.claim_kind,
      }),
    ),
  });
  return { ok: true as const, snapshot, members };
}

function parseRepasteChoices(formData: FormData): {
  acceptedRemovedClaimLineIds: string[];
  descriptionChoices: Record<string, DescriptionChoice>;
} {
  const acceptedRemovedClaimLineIds = String(formData.get("acceptedRemovedLineIds") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let descriptionChoices: Record<string, DescriptionChoice> = {};
  const raw = String(formData.get("descriptionChoicesJson") ?? "").trim();
  if (raw) {
    try {
      descriptionChoices = JSON.parse(raw) as Record<string, DescriptionChoice>;
    } catch {
      descriptionChoices = {};
    }
  }
  return { acceptedRemovedClaimLineIds, descriptionChoices };
}

export async function previewRepasteReceiptAction(
  _prev: RepastePreviewActionResult | null,
  formData: FormData,
): Promise<RepastePreviewActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const receiptId = String(formData.get("receiptId") ?? "");
    const originalText = String(formData.get("originalText") ?? "");
    const { supabase } = await db(householdId);
    const loaded = await loadReceiptRepasteSnapshot(supabase, householdId, receiptId);
    if (!loaded.ok) return { ok: false, error: loaded.error };
    if (!isReceiptRepasteEditable(loaded.snapshot.status)) {
      return {
        ok: false,
        error: "This receipt is already submitted. Use Correct receipt instead.",
      };
    }
    const parsed = parseHouseholdOsReceipt(originalText, loaded.members);
    if (!parsed.ok || !parsed.receipt) {
      return {
        ok: false,
        error: userFacingPasteError(parsed.problems, parsed.ok ? null : parsed.error),
      };
    }
    const choices = parseRepasteChoices(formData);
    const plan = buildRepastePlan(loaded.snapshot, parsed.receipt, choices);
    return { ok: true, previewJson: JSON.stringify(plan) };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function applyRepasteReceiptAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const receiptId = String(formData.get("receiptId") ?? "");
    const originalText = String(formData.get("originalText") ?? "");
    const idempotencyKey =
      String(formData.get("idempotencyKey") ?? "").trim() || randomUUID();
    const { supabase } = await db(householdId);
    const loaded = await loadReceiptRepasteSnapshot(supabase, householdId, receiptId);
    if (!loaded.ok) return { ok: false, error: loaded.error };
    if (!isReceiptRepasteEditable(loaded.snapshot.status)) {
      return {
        ok: false,
        error: "This receipt is already submitted. Use Correct receipt instead.",
      };
    }
    const parsed = parseHouseholdOsReceipt(originalText, loaded.members);
    if (!parsed.ok || !parsed.receipt) {
      return {
        ok: false,
        error: userFacingPasteError(parsed.problems, parsed.ok ? null : parsed.error),
      };
    }
    const choices = parseRepasteChoices(formData);
    const plan = buildRepastePlan(loaded.snapshot, parsed.receipt, choices);
    if (plan.applyBlockedReason) {
      return { ok: false, error: plan.applyBlockedReason };
    }
    const payload = serializeRepasteApplyPayload(
      plan,
      choices.acceptedRemovedClaimLineIds,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("apply_receipt_repaste", {
      p_receipt_id: receiptId,
      p_source_text: originalText.slice(0, 50_000),
      p_parsed_payload: {
        merchant: parsed.receipt.merchant,
        purchaseDate: parsed.receipt.purchaseDate,
        totalCents: parsed.receipt.totalCents,
        items: parsed.receipt.items.map((item) => ({
          description: item.description,
          totalCents: item.totalCents,
          quantity: item.quantity,
          raw: item.raw,
        })),
      },
      p_plan: payload,
      p_idempotency_key: idempotencyKey,
      p_reason: "user_repaste",
    });
    if (error) return { ok: false, error: mapReceiptRpcError(error.message) };
    if (data && String(data) !== receiptId) {
      return { ok: false, error: "Could not update this receipt. Try again." };
    }
    invalidate(householdId, receiptId);
    return { ok: true, message: "Corrected receipt applied.", data: { receiptId } };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}

export async function acknowledgeReceiptCorrectionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const receiptId = String(formData.get("receiptId") ?? "");
    const { supabase } = await db(householdId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("acknowledge_receipt_correction", {
      p_receipt_id: receiptId,
    });
    if (error) return { ok: false, error: mapReceiptRpcError(error.message) };
    invalidate(householdId, receiptId);
    return { ok: true, message: "Correction reviewed." };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}
