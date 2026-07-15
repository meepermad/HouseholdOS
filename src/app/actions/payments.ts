"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/app/actions/auth";
import { logServerError } from "@/lib/errors";
import { assertActiveMembership } from "@/lib/household-context";
import { mapPaymentError } from "@/lib/payments/errors";
import { can } from "@/lib/permissions";
import {
  createWaiverSchema,
  openDisputeSchema,
  paymentIdSchema,
  rejectPaymentSchema,
  resolveDisputeSchema,
  reversePaymentSchema,
  reverseWaiverSchema,
  submitPaymentSchema,
  withdrawDisputeSchema,
} from "@/lib/validations/payments";
import { z } from "zod";
import type { Json } from "@/types/database.generated";

function moneyPath(householdId: string, suffix = "") {
  return `/app/${householdId}/money${suffix}`;
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

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("submit_payment", {
      p_household_id: parsed.data.householdId,
      p_recipient_membership_id: parsed.data.recipientMembershipId,
      p_total_amount_cents: parsed.data.totalAmountCents,
      p_external_method: parsed.data.externalMethod,
      p_allocations: allocations as unknown as Json,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_claimed_paid_at: parsed.data.claimedPaidAt || undefined,
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

export async function markNotificationReadAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = z
    .object({
      householdId: z.string().uuid(),
      notificationId: z.string().uuid(),
    })
    .safeParse({
      householdId: formData.get("householdId"),
      notificationId: formData.get("notificationId"),
    });
  if (!parsed.success) return { ok: false, error: "Invalid notification." };
  await assertActiveMembership(parsed.data.householdId);
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: parsed.data.notificationId,
  });
  if (error) return { ok: false, error: "Could not update notification." };
  revalidatePath(`/app/${parsed.data.householdId}`);
  return { ok: true };
}
