"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/auth";
import { logServerError } from "@/lib/errors";
import { assertActiveMembership } from "@/lib/household-context";
import { can } from "@/lib/permissions";
import { loadHouseholdSettlementView } from "@/lib/payments/household-plan-queries";
import type { HouseholdLeg } from "@/lib/payments/household-plan";
import { EXTERNAL_PAYMENT_METHODS } from "@/lib/payments/types";
import { z } from "zod";

const uuid = z.string().uuid();

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function asRpc(client: unknown): RpcClient {
  return client as RpcClient;
}

function settlementError(message: string | undefined, fallback: string): string {
  const text = message ?? "";
  const lower = text.toLowerCase();
  if (lower.includes("no longer support") || lower.includes("plan changed")) {
    return "Those balances changed. Refresh the plan and try again.";
  }
  if (lower.includes("only the payer")) {
    return "Only the person paying can record or cancel this.";
  }
  if (lower.includes("only the recipient")) {
    return "Only the person receiving the money can confirm it.";
  }
  if (lower.includes("disputed")) {
    return "A disputed expense stays out of this plan.";
  }
  if (lower.includes("already cancelled")) {
    return "That payment record was cancelled. Refresh and use the updated plan.";
  }
  if (
    lower.includes("could not find the function") ||
    lower.includes("schema cache") ||
    lower.includes("household_net")
  ) {
    return "Recording this plan needs the latest database update.";
  }
  if (lower.includes("not authenticated")) return "Sign in again, then retry.";
  if (text.length > 0 && text.length < 160) return text;
  return fallback;
}

function mergeLegs(legs: readonly HouseholdLeg[]): {
  obligation_id: string;
  amount_cents: number;
}[] {
  const amounts = new Map<string, number>();
  for (const leg of legs) {
    amounts.set(leg.obligationId, (amounts.get(leg.obligationId) ?? 0) + leg.amountCents);
  }
  return [...amounts.entries()].map(([obligation_id, amount_cents]) => ({
    obligation_id,
    amount_cents,
  }));
}

function refreshMoney(householdId: string) {
  revalidatePath(`/app/${householdId}/money`);
  revalidatePath(`/app/${householdId}/money/simplify`);
}

export async function recordHouseholdNetPaymentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({
        householdId: uuid,
        recipientMembershipId: uuid,
        amountCents: z.coerce.number().int().positive(),
        currency: z.string().regex(/^[A-Z]{3}$/),
        externalMethod: z.enum(EXTERNAL_PAYMENT_METHODS),
        idempotencyKey: z.string().min(8),
        acknowledgeExternal: z.literal(true),
      })
      .safeParse({
        householdId: formData.get("householdId"),
        recipientMembershipId: formData.get("recipientMembershipId"),
        amountCents: formData.get("amountCents"),
        currency: formData.get("currency"),
        externalMethod: formData.get("externalMethod"),
        idempotencyKey: formData.get("idempotencyKey"),
        acknowledgeExternal:
          formData.get("acknowledgeExternal") === "on" ||
          formData.get("acknowledgeExternal") === "true"
            ? true
            : false,
      });
    if (!parsed.success) {
      return {
        ok: false,
        error: "Acknowledge that you already sent this money outside HouseholdOS.",
      };
    }

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "payment.create")) {
      return { ok: false, error: "You cannot record payments in this household." };
    }

    const view = await loadHouseholdSettlementView(parsed.data.householdId);
    if (!view.recordingReady) {
      return {
        ok: false,
        error: "Recording this plan needs the latest database update.",
      };
    }
    if (view.plan.offsets.length > 0) {
      return {
        ok: false,
        error: "Clear the amounts that already cancel before recording a payment.",
      };
    }
    const payment = view.plan.payments.find(
      (line) =>
        line.payerMembershipId === ctx.membershipId &&
        line.recipientMembershipId === parsed.data.recipientMembershipId &&
        line.amountCents === parsed.data.amountCents &&
        line.currency === parsed.data.currency,
    );
    if (!payment) {
      return {
        ok: false,
        error: "That payment is no longer on the plan. Refresh and use the updated list.",
      };
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await asRpc(supabase).rpc("submit_household_net_payment", {
      p_household_id: parsed.data.householdId,
      p_recipient_membership_id: parsed.data.recipientMembershipId,
      p_amount_cents: payment.amountCents,
      p_external_method: parsed.data.externalMethod,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_legs: mergeLegs(payment.legs),
    });
    if (error) {
      logServerError("recordHouseholdNetPayment", error);
      return {
        ok: false,
        error: settlementError(error.message, "Could not record that payment."),
      };
    }
    refreshMoney(parsed.data.householdId);
    return {
      ok: true,
      message: "Payment recorded. The recipient confirms it here after the money arrives.",
    };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    logServerError("recordHouseholdNetPayment", error);
    return { ok: false, error: "Could not record that payment." };
  }
}

export async function confirmHouseholdNetPaymentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({ householdId: uuid, netPaymentId: uuid })
      .safeParse({
        householdId: formData.get("householdId"),
        netPaymentId: formData.get("netPaymentId"),
      });
    if (!parsed.success) return { ok: false, error: "That payment could not be confirmed." };

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "payment.confirm")) {
      return { ok: false, error: "You cannot confirm payments in this household." };
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await asRpc(supabase).rpc("confirm_household_net_payment", {
      p_household_net_payment_id: parsed.data.netPaymentId,
    });
    if (error) {
      logServerError("confirmHouseholdNetPayment", error);
      return {
        ok: false,
        error: settlementError(error.message, "Could not confirm that payment."),
      };
    }
    refreshMoney(parsed.data.householdId);
    if (data === "stale") {
      return {
        ok: false,
        error: "Those balances changed. Refresh the plan and try again.",
      };
    }
    if (data !== "confirmed") {
      return { ok: false, error: "That payment is no longer waiting for confirmation." };
    }
    return { ok: true, message: "Receipt confirmed. The plan now uses what is still open." };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    logServerError("confirmHouseholdNetPayment", error);
    return { ok: false, error: "Could not confirm that payment." };
  }
}

export async function cancelHouseholdNetPaymentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({ householdId: uuid, netPaymentId: uuid })
      .safeParse({
        householdId: formData.get("householdId"),
        netPaymentId: formData.get("netPaymentId"),
      });
    if (!parsed.success) return { ok: false, error: "That payment could not be cancelled." };

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "payment.cancel")) {
      return { ok: false, error: "You cannot cancel payments in this household." };
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await asRpc(supabase).rpc("cancel_household_net_payment", {
      p_household_net_payment_id: parsed.data.netPaymentId,
    });
    if (error) {
      logServerError("cancelHouseholdNetPayment", error);
      return {
        ok: false,
        error: settlementError(error.message, "Could not cancel that payment."),
      };
    }
    refreshMoney(parsed.data.householdId);
    return { ok: true, message: "That payment record was cancelled." };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    logServerError("cancelHouseholdNetPayment", error);
    return { ok: false, error: "Could not cancel that payment." };
  }
}

export async function clearHouseholdNetOffsetsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({
        householdId: uuid,
        idempotencyKey: z.string().min(8),
      })
      .safeParse({
        householdId: formData.get("householdId"),
        idempotencyKey: formData.get("idempotencyKey"),
      });
    if (!parsed.success) {
      return { ok: false, error: "Those canceled amounts could not be cleared." };
    }

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "payment.create")) {
      return { ok: false, error: "You cannot update balances in this household." };
    }

    const view = await loadHouseholdSettlementView(parsed.data.householdId);
    if (!view.recordingReady) {
      return {
        ok: false,
        error: "Recording this plan needs the latest database update.",
      };
    }
    if (view.plan.offsets.length === 0) {
      refreshMoney(parsed.data.householdId);
      return { ok: true, message: "Those amounts are already cleared." };
    }

    const byCurrency = new Map<string, HouseholdLeg[]>();
    for (const offset of view.plan.offsets) {
      const legs = byCurrency.get(offset.currency) ?? [];
      legs.push(...offset.legs);
      byCurrency.set(offset.currency, legs);
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    for (const currency of [...byCurrency.keys()].sort()) {
      const { error } = await asRpc(supabase).rpc("clear_household_net_offsets", {
        p_household_id: parsed.data.householdId,
        p_idempotency_key: `${parsed.data.idempotencyKey}:${currency}`,
        p_legs: mergeLegs(byCurrency.get(currency) ?? []),
      });
      if (error) {
        logServerError("clearHouseholdNetOffsets", error);
        return {
          ok: false,
          error: settlementError(error.message, "Could not clear the canceled amounts."),
        };
      }
    }

    refreshMoney(parsed.data.householdId);
    return {
      ok: true,
      message: "Canceled amounts are cleared. The payments below are what is still open.",
    };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    logServerError("clearHouseholdNetOffsets", error);
    return { ok: false, error: "Could not clear the canceled amounts." };
  }
}
