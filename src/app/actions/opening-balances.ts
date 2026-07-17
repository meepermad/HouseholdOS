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

export async function createOpeningBalanceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({
        householdId: uuid,
        debtorMembershipId: uuid,
        creditorMembershipId: uuid,
        amountCents: z.coerce.number().int().positive(),
        currency: z.string().length(3),
        effectiveDate: z.string().min(8),
        explanation: z.string().trim().min(1).max(2000),
        idempotencyKey: z.string().min(8).optional().nullable(),
        submitForConfirmation: z.boolean().optional(),
      })
      .safeParse({
        householdId: formData.get("householdId"),
        debtorMembershipId: formData.get("debtorMembershipId"),
        creditorMembershipId: formData.get("creditorMembershipId"),
        amountCents: formData.get("amountCents"),
        currency: formData.get("currency") || "USD",
        effectiveDate: formData.get("effectiveDate"),
        explanation: formData.get("explanation"),
        idempotencyKey: formData.get("idempotencyKey") || null,
        submitForConfirmation: formData.get("submitForConfirmation") === "on",
      });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid entry." };
    }

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "payment.create") && !can(ctx.roles, "expense.create")) {
      return { ok: false, error: "Not allowed to create opening balances." };
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: entryId, error } = await supabase.rpc("create_opening_balance_entry", {
      p_household_id: parsed.data.householdId,
      p_debtor_membership_id: parsed.data.debtorMembershipId,
      p_creditor_membership_id: parsed.data.creditorMembershipId,
      p_amount_cents: parsed.data.amountCents,
      p_currency: parsed.data.currency.toUpperCase(),
      p_effective_date: parsed.data.effectiveDate,
      p_explanation: parsed.data.explanation,
      p_idempotency_key: parsed.data.idempotencyKey ?? undefined,
      p_attachment_storage_path: undefined,
    });
    if (error) {
      logServerError("createOpeningBalance", error);
      return { ok: false, error: error.message };
    }

    if (parsed.data.submitForConfirmation && entryId) {
      const { error: submitErr } = await supabase.rpc(
        "submit_opening_balance_for_confirmation",
        { p_entry_id: entryId },
      );
      if (submitErr) {
        logServerError("submitOpeningBalance", submitErr);
        return { ok: false, error: submitErr.message };
      }
    }

    revalidatePath(moneyPath(parsed.data.householdId));
    revalidatePath(moneyPath(parsed.data.householdId, "/opening-balances"));
    redirect(moneyPath(parsed.data.householdId, `/opening-balances/${entryId}`));
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    logServerError("createOpeningBalance", e);
    return { ok: false, error: "Could not create opening balance." };
  }
}

export async function respondOpeningBalanceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({
        householdId: uuid,
        entryId: uuid,
        decision: z.enum(["approved", "rejected"]),
        note: z.string().max(1000).optional().nullable(),
      })
      .safeParse({
        householdId: formData.get("householdId"),
        entryId: formData.get("entryId"),
        decision: formData.get("decision"),
        note: formData.get("note") || null,
      });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid response." };
    }
    await assertActiveMembership(parsed.data.householdId);
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.rpc("respond_opening_balance", {
      p_entry_id: parsed.data.entryId,
      p_decision: parsed.data.decision,
      p_note: parsed.data.note ?? undefined,
    });
    if (error) {
      logServerError("respondOpeningBalance", error);
      return { ok: false, error: error.message };
    }
    revalidatePath(moneyPath(parsed.data.householdId, "/opening-balances"));
    revalidatePath(moneyPath(parsed.data.householdId, `/opening-balances/${parsed.data.entryId}`));
    return { ok: true };
  } catch (e) {
    logServerError("respondOpeningBalance", e);
    return { ok: false, error: "Could not respond to opening balance." };
  }
}

export async function submitOpeningBalanceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({ householdId: uuid, entryId: uuid })
      .safeParse({
        householdId: formData.get("householdId"),
        entryId: formData.get("entryId"),
      });
    if (!parsed.success) {
      return { ok: false, error: "Invalid entry." };
    }
    await assertActiveMembership(parsed.data.householdId);
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.rpc("submit_opening_balance_for_confirmation", {
      p_entry_id: parsed.data.entryId,
    });
    if (error) {
      logServerError("submitOpeningBalance", error);
      return { ok: false, error: error.message };
    }
    revalidatePath(moneyPath(parsed.data.householdId, "/opening-balances"));
    return { ok: true };
  } catch (e) {
    logServerError("submitOpeningBalance", e);
    return { ok: false, error: "Could not submit opening balance." };
  }
}

export async function cancelOpeningBalanceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({ householdId: uuid, entryId: uuid })
      .safeParse({
        householdId: formData.get("householdId"),
        entryId: formData.get("entryId"),
      });
    if (!parsed.success) {
      return { ok: false, error: "Invalid entry." };
    }
    await assertActiveMembership(parsed.data.householdId);
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_opening_balance", {
      p_entry_id: parsed.data.entryId,
    });
    if (error) {
      logServerError("cancelOpeningBalance", error);
      return { ok: false, error: error.message };
    }
    revalidatePath(moneyPath(parsed.data.householdId, "/opening-balances"));
    return { ok: true };
  } catch (e) {
    logServerError("cancelOpeningBalance", e);
    return { ok: false, error: "Could not cancel opening balance." };
  }
}
