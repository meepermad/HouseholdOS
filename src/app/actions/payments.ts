"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/app/actions/auth";
import { logServerError } from "@/lib/errors";
import { assertActiveMembership } from "@/lib/household-context";
import { resolveActionNotifications } from "@/lib/notifications/resolve-actions";
import { mapPaymentError } from "@/lib/payments/errors";
import { obligationPurchaseLabel, sourceFromMaps } from "@/lib/payments/obligation-source";
import {
  listObligationBalances,
  loadObligationPurchaseSources,
} from "@/lib/payments/queries";
import {
  allocationsMatch,
  logSettlementSelection,
  reviewSettlementSubmission,
  type SubmissionAllocation,
  type SubmissionObligation,
} from "@/lib/payments/submission-check";
import { can } from "@/lib/permissions";
import {
  createWaiverSchema,
  openDisputeSchema,
  paymentIdSchema,
  rejectPaymentSchema,
  resolveDisputeSchema,
  reversePaymentSchema,
  reverseWaiverSchema,
  associatePayerReportSchema,
  submitPaymentSchema,
  withdrawDisputeSchema,
} from "@/lib/validations/payments";
import type { Json } from "@/types/database.generated";

function moneyPath(householdId: string, suffix = "") {
  return `/app/${householdId}/money${suffix}`;
}

function normalizePaidAt(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T12:00:00.000Z`;
  return value;
}

async function loadSubmissionObligations(
  householdId: string,
): Promise<SubmissionObligation[]> {
  const rows = await listObligationBalances(householdId);
  const sources = await loadObligationPurchaseSources(
    householdId,
    rows.map((row) => row.expense_id),
  );
  return rows.map((row) => ({
    id: row.obligation_id,
    label: obligationPurchaseLabel(
      sourceFromMaps(row.expense_id, row.obligation_kind, sources),
    ),
    householdId: row.household_id,
    debtorMembershipId: row.debtor_membership_id,
    creditorMembershipId: row.creditor_membership_id,
    officialOutstandingCents: row.official_outstanding_cents,
    pendingPaymentCents: row.pending_payment_cents,
    storedStatus: row.stored_status,
  }));
}

function eligibleCountFor(
  obligations: readonly SubmissionObligation[],
  actorMembershipId: string,
  counterpartyMembershipId: string,
  direction: "sent" | "received",
): number {
  return obligations.filter((row) => {
    if (row.storedStatus === "reversed" || row.officialOutstandingCents <= 0) return false;
    if (direction === "sent") {
      return (
        row.debtorMembershipId === actorMembershipId &&
        row.creditorMembershipId === counterpartyMembershipId &&
        row.officialOutstandingCents - row.pendingPaymentCents > 0
      );
    }
    return (
      row.creditorMembershipId === actorMembershipId &&
      row.debtorMembershipId === counterpartyMembershipId
    );
  }).length;
}

async function findCoveringPayment(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  params: {
    householdId: string;
    senderMembershipId: string;
    recipientMembershipId: string;
    totalAmountCents: number;
    allocations: readonly SubmissionAllocation[];
    status?: "confirmed" | "submitted";
  },
): Promise<{ id: string; createdByMembershipId: string } | null> {
  const { data: payments, error } = await supabase
    .from("payments")
    .select(
      "id, total_amount_cents, status, created_by_membership_id, sender_membership_id, recipient_membership_id",
    )
    .eq("household_id", params.householdId)
    .eq("sender_membership_id", params.senderMembershipId)
    .eq("recipient_membership_id", params.recipientMembershipId)
    .eq("status", params.status ?? "confirmed")
    .eq("total_amount_cents", params.totalAmountCents);
  if (error || !payments?.length) return null;
  const ids = payments.map((payment) => payment.id);
  const { data: rows } = await supabase
    .from("payment_allocations")
    .select("payment_id, obligation_id, amount_cents")
    .in("payment_id", ids)
    .eq("household_id", params.householdId);
  for (const payment of payments) {
    const lines = (rows ?? [])
      .filter((row) => row.payment_id === payment.id)
      .map((row) => ({
        obligationId: row.obligation_id,
        amountCents: row.amount_cents,
      }));
    if (allocationsMatch(lines, params.allocations)) {
      return { id: payment.id, createdByMembershipId: payment.created_by_membership_id };
    }
  }
  return null;
}

function parseAllocations(json: string): { obligation_id: string; amount_cents: number }[] {
  const parsed = JSON.parse(json) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Invalid allocations");
  return parsed.map((row) => {
    const r = row as { obligationId?: string; obligation_id?: string; amountCents?: number; amount_cents?: number };
    return {
      obligation_id: String(r.obligationId ?? r.obligation_id),
      amount_cents: Number(r.amountCents ?? r.amount_cents),
    };
  });
}

export async function submitPaymentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ack = formData.get("acknowledgeExternal");
    const parsed = submitPaymentSchema.safeParse({
      householdId: formData.get("householdId"),
      recipientMembershipId: formData.get("recipientMembershipId"),
      totalAmountCents: formData.get("totalAmountCents"),
      externalMethod: formData.get("externalMethod"),
      allocationsJson: formData.get("allocationsJson"),
      idempotencyKey: formData.get("idempotencyKey"),
      claimedPaidAt: formData.get("claimedPaidAt") || null,
      publicNote: formData.get("publicNote") || null,
      privateNote: formData.get("privateNote") || null,
      externalReference: formData.get("externalReference") || null,
      acknowledgeExternal: ack === "on" || ack === "true" ? true : ack,
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payment." };
    }

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "payment.create")) {
      return { ok: false, error: "Not allowed to record payments." };
    }

    let allocations: { obligation_id: string; amount_cents: number }[];
    try {
      allocations = parseAllocations(parsed.data.allocationsJson);
    } catch {
      return { ok: false, error: "Invalid payment allocations." };
    }

    const submission: SubmissionAllocation[] = allocations.map((row) => ({
      obligationId: row.obligation_id,
      amountCents: row.amount_cents,
    }));
    const obligations = await loadSubmissionObligations(parsed.data.householdId);
    logSettlementSelection({
      submittedIds: submission.map((row) => row.obligationId),
      eligibleCount: eligibleCountFor(
        obligations,
        ctx.membershipId,
        parsed.data.recipientMembershipId,
        "sent",
      ),
    });
    const review = reviewSettlementSubmission({
      direction: "sent",
      actorMembershipId: ctx.membershipId,
      counterpartyMembershipId: parsed.data.recipientMembershipId,
      householdId: parsed.data.householdId,
      totalAmountCents: parsed.data.totalAmountCents,
      allocations: submission,
      obligations,
    });
    if (!review.ok) return { ok: false, error: review.message };

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const existing = await findCoveringPayment(supabase, {
      householdId: parsed.data.householdId,
      senderMembershipId: ctx.membershipId,
      recipientMembershipId: parsed.data.recipientMembershipId,
      totalAmountCents: parsed.data.totalAmountCents,
      allocations: submission,
    });
    if (existing) {
      const recipientRecorded = existing.createdByMembershipId !== ctx.membershipId;
      return {
        ok: false,
        error: recipientRecorded
          ? "This payment was already recorded by the person who received it. You can attach your note to that record without creating a second settlement."
          : "This payment is already recorded.",
        actionHref: moneyPath(parsed.data.householdId, `/payments/${existing.id}`),
        actionLabel: recipientRecorded ? "Associate your report" : "View payment",
      };
    }

    const { data, error } = await supabase.rpc("submit_payment", {
      p_household_id: parsed.data.householdId,
      p_recipient_membership_id: parsed.data.recipientMembershipId,
      p_total_amount_cents: parsed.data.totalAmountCents,
      p_external_method: parsed.data.externalMethod,
      p_allocations: allocations as unknown as Json,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_claimed_paid_at: normalizePaidAt(parsed.data.claimedPaidAt),
      p_public_note: parsed.data.publicNote || undefined,
      p_private_note: parsed.data.privateNote || undefined,
      p_external_reference: parsed.data.externalReference || undefined,
    });

    if (error) {
      logServerError("submitPayment", error);
      return { ok: false, error: mapPaymentError(error.message).publicMessage };
    }

    revalidatePath(moneyPath(parsed.data.householdId));
    redirect(moneyPath(parsed.data.householdId, `/payments/${(data as { id: string }).id}`));
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    logServerError("submitPayment", e);
    return { ok: false, error: "This payment could not be submitted." };
  }
}

export async function recordReceivedPaymentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ack = formData.get("acknowledgeExternal");
    const payerMembershipId = String(formData.get("payerMembershipId") ?? "");
    const parsed = submitPaymentSchema.safeParse({
      householdId: formData.get("householdId"),
      recipientMembershipId: formData.get("recipientMembershipId"),
      totalAmountCents: formData.get("totalAmountCents"),
      externalMethod: formData.get("externalMethod"),
      allocationsJson: formData.get("allocationsJson"),
      idempotencyKey: formData.get("idempotencyKey"),
      claimedPaidAt: formData.get("claimedPaidAt") || null,
      publicNote: formData.get("publicNote") || null,
      privateNote: formData.get("privateNote") || null,
      externalReference: formData.get("externalReference") || null,
      acknowledgeExternal: ack === "on" || ack === "true" ? true : ack,
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payment." };
    }
    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "payment.confirm")) {
      return { ok: false, error: "Not allowed to record a payment you received." };
    }
    if (parsed.data.recipientMembershipId !== ctx.membershipId) {
      return { ok: false, error: "Only the person who is owed this money can record receiving it." };
    }
    if (!/^[0-9a-f-]{36}$/i.test(payerMembershipId)) {
      return { ok: false, error: "Choose who paid you." };
    }

    let allocations: { obligation_id: string; amount_cents: number }[];
    try {
      allocations = parseAllocations(parsed.data.allocationsJson);
    } catch {
      return { ok: false, error: "Invalid payment allocations." };
    }
    const submission: SubmissionAllocation[] = allocations.map((row) => ({
      obligationId: row.obligation_id,
      amountCents: row.amount_cents,
    }));
    const obligations = await loadSubmissionObligations(parsed.data.householdId);
    logSettlementSelection({
      submittedIds: submission.map((row) => row.obligationId),
      eligibleCount: eligibleCountFor(
        obligations,
        ctx.membershipId,
        payerMembershipId,
        "received",
      ),
    });
    const review = reviewSettlementSubmission({
      direction: "received",
      actorMembershipId: ctx.membershipId,
      counterpartyMembershipId: payerMembershipId,
      householdId: parsed.data.householdId,
      totalAmountCents: parsed.data.totalAmountCents,
      allocations: submission,
      obligations,
    });
    if (!review.ok) return { ok: false, error: review.message };

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("record_received_payment", {
      p_household_id: parsed.data.householdId,
      p_payer_membership_id: payerMembershipId,
      p_total_amount_cents: parsed.data.totalAmountCents,
      p_external_method: parsed.data.externalMethod,
      p_allocations: allocations as unknown as Json,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_claimed_paid_at: normalizePaidAt(parsed.data.claimedPaidAt),
      p_public_note: parsed.data.publicNote || undefined,
      p_private_note: parsed.data.privateNote || undefined,
      p_external_reference: parsed.data.externalReference || undefined,
    });
    if (error) {
      logServerError("recordReceivedPayment", error);
      return { ok: false, error: mapPaymentError(error.message).publicMessage };
    }
    revalidatePath(moneyPath(parsed.data.householdId));
    redirect(moneyPath(parsed.data.householdId, `/payments/${(data as { id: string }).id}`));
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    logServerError("recordReceivedPayment", e);
    return { ok: false, error: "This payment could not be recorded." };
  }
}

export async function associatePayerReportAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = associatePayerReportSchema.safeParse({
      householdId: formData.get("householdId"),
      paymentId: formData.get("paymentId"),
      idempotencyKey: formData.get("idempotencyKey"),
      note: formData.get("note") || null,
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid report." };
    }
    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "payment.create")) {
      return { ok: false, error: "Not allowed." };
    }
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.rpc("associate_payer_report", {
      p_payment_id: parsed.data.paymentId,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_note: parsed.data.note || undefined,
    });
    if (error) {
      logServerError("associatePayerReport", error);
      return { ok: false, error: mapPaymentError(error.message).publicMessage };
    }
    revalidatePath(moneyPath(parsed.data.householdId));
    redirect(moneyPath(parsed.data.householdId, `/payments/${parsed.data.paymentId}`));
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { ok: false, error: "Your report could not be attached." };
  }
}

export async function confirmPaymentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const base = paymentIdSchema.safeParse({
      householdId: formData.get("householdId"),
      paymentId: formData.get("paymentId"),
    });
    if (!base.success) return { ok: false, error: "Invalid payment." };
    const ctx = await assertActiveMembership(base.data.householdId);
    if (!can(ctx.roles, "payment.confirm")) {
      return { ok: false, error: "Not allowed." };
    }
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.rpc("confirm_payment", {
      p_payment_id: base.data.paymentId,
    });
    if (error) {
      logServerError("payment.confirm", error);
      return { ok: false, error: mapPaymentError(error.message).publicMessage };
    }
    await resolveActionNotifications("payment", base.data.paymentId);
    revalidatePath(moneyPath(base.data.householdId));
    redirect(moneyPath(base.data.householdId, `/payments/${base.data.paymentId}`));
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { ok: false, error: "This payment action could not be completed." };
  }
}

export async function rejectPaymentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = rejectPaymentSchema.safeParse({
      householdId: formData.get("householdId"),
      paymentId: formData.get("paymentId"),
      reason: formData.get("reason"),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rejection." };
    }
    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "payment.reject")) {
      return { ok: false, error: "Not allowed." };
    }
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.rpc("reject_payment", {
      p_payment_id: parsed.data.paymentId,
      p_reason: parsed.data.reason,
    });
    if (error) {
      return { ok: false, error: mapPaymentError(error.message).publicMessage };
    }
    await resolveActionNotifications("payment", parsed.data.paymentId);
    revalidatePath(moneyPath(parsed.data.householdId));
    redirect(moneyPath(parsed.data.householdId, `/payments/${parsed.data.paymentId}`));
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { ok: false, error: "Rejection failed." };
  }
}

export async function cancelPaymentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = paymentIdSchema.safeParse({
      householdId: formData.get("householdId"),
      paymentId: formData.get("paymentId"),
    });
    if (!parsed.success) return { ok: false, error: "Invalid payment." };
    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "payment.cancel")) {
      return { ok: false, error: "Not allowed." };
    }
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_payment", {
      p_payment_id: parsed.data.paymentId,
    });
    if (error) {
      return { ok: false, error: mapPaymentError(error.message).publicMessage };
    }
    revalidatePath(moneyPath(parsed.data.householdId));
    redirect(moneyPath(parsed.data.householdId, `/payments/${parsed.data.paymentId}`));
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { ok: false, error: "Cancellation failed." };
  }
}

export async function reversePaymentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = reversePaymentSchema.safeParse({
      householdId: formData.get("householdId"),
      paymentId: formData.get("paymentId"),
      reason: formData.get("reason"),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid reversal." };
    }
    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "payment.reverse")) {
      return { ok: false, error: "Not allowed." };
    }
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.rpc("reverse_payment", {
      p_payment_id: parsed.data.paymentId,
      p_reason: parsed.data.reason,
    });
    if (error) {
      return { ok: false, error: mapPaymentError(error.message).publicMessage };
    }
    revalidatePath(moneyPath(parsed.data.householdId));
    redirect(moneyPath(parsed.data.householdId, `/payments/${parsed.data.paymentId}`));
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { ok: false, error: "Reversal failed." };
  }
}

export async function createWaiverAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = createWaiverSchema.safeParse({
      householdId: formData.get("householdId"),
      obligationId: formData.get("obligationId"),
      amountCents: formData.get("amountCents"),
      reason: formData.get("reason"),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid waiver." };
    }
    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "waiver.create")) {
      return { ok: false, error: "Not allowed." };
    }
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_reimbursement_waiver", {
      p_obligation_id: parsed.data.obligationId,
      p_amount_cents: parsed.data.amountCents,
      p_reason: parsed.data.reason,
    });
    if (error) {
      return { ok: false, error: mapPaymentError(error.message).publicMessage };
    }
    revalidatePath(moneyPath(parsed.data.householdId));
    redirect(
      moneyPath(parsed.data.householdId, `/reimbursements/${parsed.data.obligationId}`),
    );
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { ok: false, error: "Waiver could not be created." };
  }
}

export async function reverseWaiverAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = reverseWaiverSchema.safeParse({
      householdId: formData.get("householdId"),
      waiverId: formData.get("waiverId"),
      reason: formData.get("reason"),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid waiver reversal." };
    }
    await assertActiveMembership(parsed.data.householdId);
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.rpc("reverse_reimbursement_waiver", {
      p_waiver_id: parsed.data.waiverId,
      p_reason: parsed.data.reason,
    });
    if (error) {
      return { ok: false, error: mapPaymentError(error.message).publicMessage };
    }
    revalidatePath(moneyPath(parsed.data.householdId));
    return { ok: true };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { ok: false, error: "Waiver reversal failed." };
  }
}

export async function openDisputeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = openDisputeSchema.safeParse({
      householdId: formData.get("householdId"),
      disputeType: formData.get("disputeType"),
      reason: formData.get("reason"),
      expenseId: formData.get("expenseId") || null,
      obligationId: formData.get("obligationId") || null,
      paymentId: formData.get("paymentId") || null,
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid dispute." };
    }
    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "dispute.open")) {
      return { ok: false, error: "Not allowed." };
    }
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("open_dispute", {
      p_household_id: parsed.data.householdId,
      p_dispute_type: parsed.data.disputeType,
      p_reason: parsed.data.reason,
      p_expense_id: parsed.data.expenseId ?? undefined,
      p_obligation_id: parsed.data.obligationId ?? undefined,
      p_payment_id: parsed.data.paymentId ?? undefined,
    });
    if (error) {
      return { ok: false, error: mapPaymentError(error.message).publicMessage };
    }
    revalidatePath(moneyPath(parsed.data.householdId));
    redirect(
      moneyPath(parsed.data.householdId, `/disputes/${(data as { id: string }).id}`),
    );
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { ok: false, error: "Dispute could not be opened." };
  }
}

export async function resolveDisputeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = resolveDisputeSchema.safeParse({
      householdId: formData.get("householdId"),
      disputeId: formData.get("disputeId"),
      resolutionType: formData.get("resolutionType"),
      resolutionNote: formData.get("resolutionNote"),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid resolution." };
    }
    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "dispute.resolve")) {
      return { ok: false, error: "Not allowed." };
    }
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.rpc("resolve_dispute", {
      p_dispute_id: parsed.data.disputeId,
      p_resolution_type: parsed.data.resolutionType,
      p_resolution_note: parsed.data.resolutionNote,
    });
    if (error) {
      return { ok: false, error: mapPaymentError(error.message).publicMessage };
    }
    await resolveActionNotifications(
      "reimbursement_dispute",
      parsed.data.disputeId,
    );
    revalidatePath(moneyPath(parsed.data.householdId));
    redirect(moneyPath(parsed.data.householdId, `/disputes/${parsed.data.disputeId}`));
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { ok: false, error: "Dispute could not be resolved." };
  }
}

export async function withdrawDisputeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = withdrawDisputeSchema.safeParse({
      householdId: formData.get("householdId"),
      disputeId: formData.get("disputeId"),
    });
    if (!parsed.success) return { ok: false, error: "Invalid dispute." };
    await assertActiveMembership(parsed.data.householdId);
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.rpc("withdraw_dispute", {
      p_dispute_id: parsed.data.disputeId,
    });
    if (error) {
      return { ok: false, error: mapPaymentError(error.message).publicMessage };
    }
    revalidatePath(moneyPath(parsed.data.householdId));
    redirect(moneyPath(parsed.data.householdId, `/disputes/${parsed.data.disputeId}`));
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { ok: false, error: "Dispute could not be withdrawn." };
  }
}
