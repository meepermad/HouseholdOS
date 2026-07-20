"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/app/actions/auth";
import { logServerError } from "@/lib/errors";
import { assertActiveMembership } from "@/lib/household-context";
import { can } from "@/lib/permissions";
import { z } from "zod";

const uuid = z.string().uuid();

function moneyPath(householdId: string, suffix = "") {
  return `/app/${householdId}/money${suffix}`;
}

export async function proposeRoutedSettlementAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({
        householdId: uuid,
        payerMembershipId: uuid,
        intermediaryMembershipId: uuid,
        recipientMembershipId: uuid,
        amountCents: z.coerce.number().int().positive(),
        obligationAbId: uuid,
        obligationBcId: uuid,
        idempotencyKey: z.string().min(8),
      })
      .safeParse({
        householdId: formData.get("householdId"),
        payerMembershipId: formData.get("payerMembershipId"),
        intermediaryMembershipId: formData.get("intermediaryMembershipId"),
        recipientMembershipId: formData.get("recipientMembershipId"),
        amountCents: formData.get("amountCents"),
        obligationAbId: formData.get("obligationAbId"),
        obligationBcId: formData.get("obligationBcId"),
        idempotencyKey: formData.get("idempotencyKey"),
      });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid proposal." };
    }

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "payment.create")) {
      return { ok: false, error: "Not allowed to propose routed payments." };
    }
    if (ctx.membershipId !== parsed.data.payerMembershipId) {
      return {
        ok: false,
        error: "Only the payer may create a routed settlement proposal.",
      };
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: proposalId, error } = await supabase.rpc(
      "create_routed_settlement_proposal",
      {
        p_household_id: parsed.data.householdId,
        p_payer_membership_id: parsed.data.payerMembershipId,
        p_intermediary_membership_id: parsed.data.intermediaryMembershipId,
        p_recipient_membership_id: parsed.data.recipientMembershipId,
        p_amount_cents: parsed.data.amountCents,
        p_obligation_ab_id: parsed.data.obligationAbId,
        p_obligation_bc_id: parsed.data.obligationBcId,
        p_idempotency_key: parsed.data.idempotencyKey,
      },
    );
    if (error) {
      logServerError("proposeRoutedSettlement", error);
      return { ok: false, error: error.message };
    }

    revalidatePath(moneyPath(parsed.data.householdId, "/simplify"));
    redirect(moneyPath(parsed.data.householdId, `/simplify/${proposalId}`));
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    logServerError("proposeRoutedSettlement", e);
    return { ok: false, error: "Could not create routed payment proposal." };
  }
}

export async function approveRoutedIntermediaryAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({
        householdId: uuid,
        proposalId: uuid,
        decision: z.enum(["approved", "rejected"]),
        note: z.string().max(1000).optional().nullable(),
      })
      .safeParse({
        householdId: formData.get("householdId"),
        proposalId: formData.get("proposalId"),
        decision: formData.get("decision"),
        note: formData.get("note") || null,
      });
    if (!parsed.success) {
      return { ok: false, error: "Invalid decision." };
    }
    await assertActiveMembership(parsed.data.householdId);
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.rpc("approve_routed_settlement_intermediary", {
      p_proposal_id: parsed.data.proposalId,
      p_decision: parsed.data.decision,
      p_note: parsed.data.note ?? undefined,
    });
    if (error) {
      logServerError("approveRoutedIntermediary", error);
      return { ok: false, error: error.message };
    }
    revalidatePath(moneyPath(parsed.data.householdId, `/simplify/${parsed.data.proposalId}`));
    return { ok: true };
  } catch (e) {
    logServerError("approveRoutedIntermediary", e);
    return { ok: false, error: "Could not record intermediary decision." };
  }
}

export async function acceptRoutedRecipientAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({
        householdId: uuid,
        proposalId: uuid,
        decision: z.enum(["accepted", "rejected"]),
        note: z.string().max(1000).optional().nullable(),
      })
      .safeParse({
        householdId: formData.get("householdId"),
        proposalId: formData.get("proposalId"),
        decision: formData.get("decision"),
        note: formData.get("note") || null,
      });
    if (!parsed.success) {
      return { ok: false, error: "Invalid decision." };
    }
    await assertActiveMembership(parsed.data.householdId);
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.rpc("accept_routed_settlement_recipient", {
      p_proposal_id: parsed.data.proposalId,
      p_decision: parsed.data.decision,
      p_note: parsed.data.note ?? undefined,
    });
    if (error) {
      logServerError("acceptRoutedRecipient", error);
      return { ok: false, error: error.message };
    }
    revalidatePath(moneyPath(parsed.data.householdId, `/simplify/${parsed.data.proposalId}`));
    return { ok: true };
  } catch (e) {
    logServerError("acceptRoutedRecipient", e);
    return { ok: false, error: "Could not record recipient decision." };
  }
}

export async function submitRoutedPaymentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({
        householdId: uuid,
        proposalId: uuid,
        externalMethod: z.string().min(2).max(40),
        idempotencyKey: z.string().min(8),
        publicNote: z.string().max(500).optional().nullable(),
        acknowledgeExternal: z.literal(true),
      })
      .safeParse({
        householdId: formData.get("householdId"),
        proposalId: formData.get("proposalId"),
        externalMethod: formData.get("externalMethod"),
        idempotencyKey: formData.get("idempotencyKey"),
        publicNote: formData.get("publicNote") || null,
        acknowledgeExternal:
          formData.get("acknowledgeExternal") === "on" ||
          formData.get("acknowledgeExternal") === "true"
            ? true
            : false,
      });
    if (!parsed.success) {
      return {
        ok: false,
        error:
          parsed.error.issues[0]?.message ??
          "Acknowledge that money moved outside HouseholdOS.",
      };
    }
    await assertActiveMembership(parsed.data.householdId);
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.rpc("submit_routed_settlement_payment", {
      p_proposal_id: parsed.data.proposalId,
      p_external_method: parsed.data.externalMethod,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_public_note: parsed.data.publicNote ?? undefined,
    });
    if (error) {
      logServerError("submitRoutedPayment", error);
      return { ok: false, error: error.message };
    }
    revalidatePath(moneyPath(parsed.data.householdId, `/simplify/${parsed.data.proposalId}`));
    return { ok: true };
  } catch (e) {
    logServerError("submitRoutedPayment", e);
    return { ok: false, error: "Could not record routed payment." };
  }
}

export async function confirmRoutedSettlementAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({ householdId: uuid, proposalId: uuid })
      .safeParse({
        householdId: formData.get("householdId"),
        proposalId: formData.get("proposalId"),
      });
    if (!parsed.success) {
      return { ok: false, error: "Invalid proposal." };
    }
    await assertActiveMembership(parsed.data.householdId);
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.rpc("confirm_routed_settlement", {
      p_proposal_id: parsed.data.proposalId,
    });
    if (error) {
      logServerError("confirmRoutedSettlement", error);
      return { ok: false, error: error.message };
    }
    revalidatePath(moneyPath(parsed.data.householdId));
    revalidatePath(moneyPath(parsed.data.householdId, `/simplify/${parsed.data.proposalId}`));
    return { ok: true };
  } catch (e) {
    logServerError("confirmRoutedSettlement", e);
    return { ok: false, error: "Could not confirm routed payment." };
  }
}

export async function cancelRoutedSettlementAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({ householdId: uuid, proposalId: uuid })
      .safeParse({
        householdId: formData.get("householdId"),
        proposalId: formData.get("proposalId"),
      });
    if (!parsed.success) {
      return { ok: false, error: "Invalid proposal." };
    }
    await assertActiveMembership(parsed.data.householdId);
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_routed_settlement", {
      p_proposal_id: parsed.data.proposalId,
    });
    if (error) {
      logServerError("cancelRoutedSettlement", error);
      return { ok: false, error: error.message };
    }
    revalidatePath(moneyPath(parsed.data.householdId, "/simplify"));
    return { ok: true };
  } catch (e) {
    logServerError("cancelRoutedSettlement", e);
    return { ok: false, error: "Could not cancel proposal." };
  }
}

export async function requestRoutedCorrectionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({
        householdId: uuid,
        proposalId: uuid,
        correctionPath: z.enum([
          "external_payment_returned",
          "accounting_correction",
          "payment_confirmation_disputed",
          "administrative_correction",
        ]),
        reason: z.string().trim().min(3).max(1000),
      })
      .safeParse({
        householdId: formData.get("householdId"),
        proposalId: formData.get("proposalId"),
        correctionPath: formData.get("correctionPath"),
        reason: formData.get("reason"),
      });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
    }
    await assertActiveMembership(parsed.data.householdId);
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.rpc("request_routed_settlement_correction", {
      p_proposal_id: parsed.data.proposalId,
      p_correction_path: parsed.data.correctionPath,
      p_reason: parsed.data.reason,
    });
    if (error) {
      logServerError("requestRoutedCorrection", error);
      return { ok: false, error: error.message };
    }
    revalidatePath(moneyPath(parsed.data.householdId, `/simplify/${parsed.data.proposalId}`));
    return { ok: true };
  } catch (e) {
    logServerError("requestRoutedCorrection", e);
    return { ok: false, error: "Could not request correction." };
  }
}

export async function respondRoutedCorrectionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({
        householdId: uuid,
        requestId: uuid,
        decision: z.enum([
          "confirmed_return",
          "declined_return",
          "disputed_receipt",
          "approved",
          "declined",
        ]),
        note: z.string().max(1000).optional().nullable(),
      })
      .safeParse({
        householdId: formData.get("householdId"),
        requestId: formData.get("requestId"),
        decision: formData.get("decision"),
        note: formData.get("note") || null,
      });
    if (!parsed.success) {
      return { ok: false, error: "Invalid decision." };
    }
    await assertActiveMembership(parsed.data.householdId);
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.rpc("respond_routed_settlement_correction", {
      p_request_id: parsed.data.requestId,
      p_decision: parsed.data.decision,
      p_note: parsed.data.note ?? undefined,
    });
    if (error) {
      logServerError("respondRoutedCorrection", error);
      return { ok: false, error: error.message };
    }
    revalidatePath(moneyPath(parsed.data.householdId));
    return { ok: true };
  } catch (e) {
    logServerError("respondRoutedCorrection", e);
    return { ok: false, error: "Could not record correction response." };
  }
}
