"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/app/actions/auth";
import { toPublicErrorMessage } from "@/lib/errors";
import { assertActiveMembership } from "@/lib/household-context";
import {
  extractBlockingPaymentId,
  mapPaymentError,
} from "@/lib/payments/errors";
import { itemTagToWrite } from "@/lib/expenses/apply-item-tag";
import { can } from "@/lib/permissions";
import {
  buildConfirmationSnapshot,
  loadExpenseBundle,
  recalculateBundle,
} from "@/lib/expenses/load-bundle";
import {
  amendExpenseSchema,
  confirmExpenseSchema,
  parseMembershipIds,
  retagExpenseItemSchema,
  createExpenseDraftSchema,
  deleteExpenseAdjustmentSchema,
  deleteExpenseItemSchema,
  expenseIdSchema,
  submitExpenseReviewSchema,
  updateExpenseHeaderSchema,
  humanizeExpenseValidationError,
  upsertExpenseAdjustmentSchema,
  upsertExpenseItemSchema,
  voidExpenseSchema,
} from "@/lib/validations/expenses";

function moneyPath(householdId: string, suffix = "") {
  return `/app/${householdId}/money${suffix}`;
}

function parseParticipants(formData: FormData) {
  const raw = formData.get("participantsJson");
  if (!raw || typeof raw !== "string" || raw.trim() === "") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === "object",
      )
      .map((row) => {
        const out: Record<string, unknown> = { membershipId: row.membershipId };
        if (row.fixedCents != null && row.fixedCents !== "") {
          out.fixedCents = row.fixedCents;
        }
        if (row.percentBps != null && row.percentBps !== "") {
          out.percentBps = row.percentBps;
        }
        if (row.weight != null && row.weight !== "") {
          out.weight = row.weight;
        }
        return out;
      });
  } catch {
    return [];
  }
}

function boolFromForm(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

export async function createExpenseDraftAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = createExpenseDraftSchema.safeParse({
      householdId: formData.get("householdId"),
      payerMembershipId: formData.get("payerMembershipId"),
      merchant: formData.get("merchant"),
      description: formData.get("description") || "",
      category: formData.get("category") || null,
      purchaseDate: formData.get("purchaseDate"),
      declaredTotalCents: formData.get("declaredTotalCents"),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid expense." };
    }

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "expense.create")) {
      return { ok: false, error: "Not allowed to create expenses." };
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { data: household } = await supabase
      .from("households")
      .select("currency")
      .eq("id", parsed.data.householdId)
      .single();
    if (!household) return { ok: false, error: "Household not found." };

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        household_id: parsed.data.householdId,
        created_by_membership_id: ctx.membershipId,
        payer_membership_id: parsed.data.payerMembershipId,
        merchant: parsed.data.merchant,
        description: parsed.data.description || "",
        category: parsed.data.category || null,
        purchase_date: parsed.data.purchaseDate,
        currency: household.currency,
        declared_total_cents: parsed.data.declaredTotalCents,
        status: "draft",
      })
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: "Unable to create expense draft." };
    }

    await supabase.rpc("write_audit_event", {
      p_household_id: parsed.data.householdId,
      p_entity_type: "expense",
      p_entity_id: data.id,
      p_event_type: "expense.created",
      p_after_state: {
        merchant: parsed.data.merchant,
        declared_total_cents: parsed.data.declaredTotalCents,
        status: "draft",
      },
    });

    revalidatePath(moneyPath(parsed.data.householdId));
    redirect(moneyPath(parsed.data.householdId, `/expenses/${data.id}/edit`));
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function updateExpenseHeaderAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = updateExpenseHeaderSchema.safeParse({
      householdId: formData.get("householdId"),
      expenseId: formData.get("expenseId"),
      payerMembershipId: formData.get("payerMembershipId"),
      merchant: formData.get("merchant"),
      description: formData.get("description") || "",
      category: formData.get("category") || null,
      purchaseDate: formData.get("purchaseDate"),
      declaredTotalCents: formData.get("declaredTotalCents"),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid expense." };
    }

    await assertActiveMembership(parsed.data.householdId);
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { error } = await supabase
      .from("expenses")
      .update({
        payer_membership_id: parsed.data.payerMembershipId,
        merchant: parsed.data.merchant,
        description: parsed.data.description || "",
        category: parsed.data.category || null,
        purchase_date: parsed.data.purchaseDate,
        declared_total_cents: parsed.data.declaredTotalCents,
      })
      .eq("id", parsed.data.expenseId)
      .eq("household_id", parsed.data.householdId);

    if (error) return { ok: false, error: "Unable to update expense." };

    revalidatePath(moneyPath(parsed.data.householdId, `/expenses/${parsed.data.expenseId}`));
    return { ok: true, message: "Expense updated." };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function upsertExpenseItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = upsertExpenseItemSchema.safeParse({
      householdId: formData.get("householdId"),
      expenseId: formData.get("expenseId"),
      itemId: formData.get("itemId") || undefined,
      description: formData.get("description"),
      quantityLabel: formData.get("quantityLabel") || "",
      totalCents: formData.get("totalCents"),
      displayOrder: formData.get("displayOrder") || 0,
      allocationMode: formData.get("allocationMode"),
      personalMembershipId: formData.get("personalMembershipId") || null,
      excludeFromAdjustmentBasis: formData.get("excludeFromAdjustmentBasis") || undefined,
      participants: parseParticipants(formData),
    });
    if (!parsed.success) {
      return {
        ok: false,
        error: humanizeExpenseValidationError(parsed.error, "This line item could not be saved."),
      };
    }

    await assertActiveMembership(parsed.data.householdId);
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    let itemId = parsed.data.itemId;
    if (itemId) {
      const { error } = await supabase
        .from("expense_items")
        .update({
          description: parsed.data.description,
          quantity_label: parsed.data.quantityLabel || null,
          total_cents: parsed.data.totalCents,
          display_order: parsed.data.displayOrder,
          allocation_mode: parsed.data.allocationMode,
          personal_membership_id: parsed.data.personalMembershipId || null,
          exclude_from_adjustment_basis: boolFromForm(
            formData.get("excludeFromAdjustmentBasis"),
          ),
        })
        .eq("id", itemId)
        .eq("expense_id", parsed.data.expenseId);
      if (error) return { ok: false, error: "Unable to update line item." };
      await supabase.from("expense_item_allocations").delete().eq("item_id", itemId);
    } else {
      const { data, error } = await supabase
        .from("expense_items")
        .insert({
          expense_id: parsed.data.expenseId,
          household_id: parsed.data.householdId,
          description: parsed.data.description,
          quantity_label: parsed.data.quantityLabel || null,
          total_cents: parsed.data.totalCents,
          display_order: parsed.data.displayOrder,
          allocation_mode: parsed.data.allocationMode,
          personal_membership_id: parsed.data.personalMembershipId || null,
          exclude_from_adjustment_basis: boolFromForm(
            formData.get("excludeFromAdjustmentBasis"),
          ),
        })
        .select("id")
        .single();
      if (error || !data) return { ok: false, error: "Unable to add line item." };
      itemId = data.id;
    }

    if (parsed.data.participants.length > 0) {
      const { error: allocError } = await supabase.from("expense_item_allocations").insert(
        parsed.data.participants.map((p) => ({
          item_id: itemId!,
          expense_id: parsed.data.expenseId,
          household_id: parsed.data.householdId,
          membership_id: p.membershipId,
          amount_cents: 0,
          fixed_cents: p.fixedCents ?? null,
          percent_bps: p.percentBps ?? null,
          weight: p.weight ?? null,
        })),
      );
      if (allocError) return { ok: false, error: "Unable to save item allocations." };
    }

    // For personal mode, ensure an allocation input row exists for the owner.
    if (parsed.data.allocationMode === "personal" && parsed.data.personalMembershipId) {
      await supabase.from("expense_item_allocations").upsert(
        {
          item_id: itemId!,
          expense_id: parsed.data.expenseId,
          household_id: parsed.data.householdId,
          membership_id: parsed.data.personalMembershipId,
          amount_cents: 0,
        },
        { onConflict: "item_id,membership_id" },
      );
    }

    revalidatePath(moneyPath(parsed.data.householdId, `/expenses/${parsed.data.expenseId}/edit`));
    return { ok: true, message: "Line item saved.", data: { itemId: itemId! } };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function deleteExpenseItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = deleteExpenseItemSchema.safeParse({
      householdId: formData.get("householdId"),
      expenseId: formData.get("expenseId"),
      itemId: formData.get("itemId"),
    });
    if (!parsed.success) return { ok: false, error: "Invalid item." };

    await assertActiveMembership(parsed.data.householdId);
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { error } = await supabase
      .from("expense_items")
      .delete()
      .eq("id", parsed.data.itemId)
      .eq("expense_id", parsed.data.expenseId);
    if (error) return { ok: false, error: "Unable to remove line item." };

    revalidatePath(moneyPath(parsed.data.householdId, `/expenses/${parsed.data.expenseId}/edit`));
    return { ok: true, message: "Line item removed." };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function upsertExpenseAdjustmentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = upsertExpenseAdjustmentSchema.safeParse({
      householdId: formData.get("householdId"),
      expenseId: formData.get("expenseId"),
      adjustmentId: formData.get("adjustmentId") || undefined,
      adjustmentType: formData.get("adjustmentType"),
      description: formData.get("description"),
      amountCents: formData.get("amountCents"),
      allocationMode: formData.get("allocationMode"),
      assignedMembershipId: formData.get("assignedMembershipId") || null,
      displayOrder: formData.get("displayOrder") || 0,
      participants: parseParticipants(formData),
    });
    if (!parsed.success) {
      return {
        ok: false,
        error: humanizeExpenseValidationError(parsed.error, "This adjustment could not be saved."),
      };
    }

    await assertActiveMembership(parsed.data.householdId);
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    let adjustmentId = parsed.data.adjustmentId;
    if (adjustmentId) {
      const { error } = await supabase
        .from("expense_adjustments")
        .update({
          adjustment_type: parsed.data.adjustmentType,
          description: parsed.data.description,
          amount_cents: parsed.data.amountCents,
          allocation_mode: parsed.data.allocationMode,
          assigned_membership_id: parsed.data.assignedMembershipId || null,
          display_order: parsed.data.displayOrder,
        })
        .eq("id", adjustmentId)
        .eq("expense_id", parsed.data.expenseId);
      if (error) return { ok: false, error: "Unable to update adjustment." };
      await supabase
        .from("expense_adjustment_allocations")
        .delete()
        .eq("adjustment_id", adjustmentId);
    } else {
      const { data, error } = await supabase
        .from("expense_adjustments")
        .insert({
          expense_id: parsed.data.expenseId,
          household_id: parsed.data.householdId,
          adjustment_type: parsed.data.adjustmentType,
          description: parsed.data.description,
          amount_cents: parsed.data.amountCents,
          allocation_mode: parsed.data.allocationMode,
          assigned_membership_id: parsed.data.assignedMembershipId || null,
          display_order: parsed.data.displayOrder,
        })
        .select("id")
        .single();
      if (error || !data) return { ok: false, error: "Unable to add adjustment." };
      adjustmentId = data.id;
    }

    if (parsed.data.participants.length > 0) {
      const { error: allocError } = await supabase
        .from("expense_adjustment_allocations")
        .insert(
          parsed.data.participants.map((p) => ({
            adjustment_id: adjustmentId!,
            expense_id: parsed.data.expenseId,
            household_id: parsed.data.householdId,
            membership_id: p.membershipId,
            amount_cents: 0,
            fixed_cents: p.fixedCents ?? null,
            percent_bps: p.percentBps ?? null,
            weight: p.weight ?? null,
          })),
        );
      if (allocError) return { ok: false, error: "Unable to save adjustment allocations." };
    }

    revalidatePath(moneyPath(parsed.data.householdId, `/expenses/${parsed.data.expenseId}/edit`));
    return { ok: true, message: "Adjustment saved." };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function deleteExpenseAdjustmentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = deleteExpenseAdjustmentSchema.safeParse({
      householdId: formData.get("householdId"),
      expenseId: formData.get("expenseId"),
      adjustmentId: formData.get("adjustmentId"),
    });
    if (!parsed.success) return { ok: false, error: "Invalid adjustment." };

    await assertActiveMembership(parsed.data.householdId);
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { error } = await supabase
      .from("expense_adjustments")
      .delete()
      .eq("id", parsed.data.adjustmentId)
      .eq("expense_id", parsed.data.expenseId);
    if (error) return { ok: false, error: "Unable to remove adjustment." };

    revalidatePath(moneyPath(parsed.data.householdId, `/expenses/${parsed.data.expenseId}/edit`));
    return { ok: true, message: "Adjustment removed." };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function submitExpenseForReviewAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = submitExpenseReviewSchema.safeParse({
      householdId: formData.get("householdId"),
      expenseId: formData.get("expenseId"),
    });
    if (!parsed.success) return { ok: false, error: "Invalid expense." };

    await assertActiveMembership(parsed.data.householdId);
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const bundle = await loadExpenseBundle(supabase, parsed.data.expenseId);
    if (!bundle || bundle.expense.household_id !== parsed.data.householdId) {
      return { ok: false, error: "Expense not found." };
    }

    const calc = recalculateBundle(bundle);
    if (!calc.ok) {
      return { ok: false, error: calc.message };
    }

    const { error } = await supabase
      .from("expenses")
      .update({
        status: "ready_for_review",
        calculated_subtotal_cents: calc.itemSubtotalCents,
        calculated_adjustments_cents: calc.adjustmentsNetCents,
      })
      .eq("id", parsed.data.expenseId)
      .eq("household_id", parsed.data.householdId);

    if (error) return { ok: false, error: "Unable to submit for review." };

    await supabase.rpc("write_audit_event", {
      p_household_id: parsed.data.householdId,
      p_entity_type: "expense",
      p_entity_id: parsed.data.expenseId,
      p_event_type: "expense.submitted_for_review",
      p_after_state: { status: "ready_for_review" },
    });

    revalidatePath(moneyPath(parsed.data.householdId));
    redirect(moneyPath(parsed.data.householdId, `/expenses/${parsed.data.expenseId}/review`));
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function confirmExpenseAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = confirmExpenseSchema.safeParse({
      householdId: formData.get("householdId"),
      expenseId: formData.get("expenseId"),
      idempotencyKey: formData.get("idempotencyKey"),
    });
    if (!parsed.success) return { ok: false, error: "Invalid confirmation request." };

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "expense.confirm")) {
      return { ok: false, error: "Not allowed to confirm expenses." };
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const bundle = await loadExpenseBundle(supabase, parsed.data.expenseId);
    if (!bundle || bundle.expense.household_id !== parsed.data.householdId) {
      return { ok: false, error: "Expense not found." };
    }

    // Reload membership eligibility at confirm time
    const fresh = await loadExpenseBundle(supabase, parsed.data.expenseId);
    if (!fresh) return { ok: false, error: "Expense not found." };

    const calc = recalculateBundle(fresh);
    if (!calc.ok) {
      return { ok: false, error: calc.message };
    }

    const snapshot = buildConfirmationSnapshot(calc);
    const isAmendment = Boolean(fresh.expense.supersedes_expense_id);

    const { error } = isAmendment
      ? await supabase.rpc("confirm_expense_amendment", {
          p_amendment_expense_id: parsed.data.expenseId,
          p_idempotency_key: parsed.data.idempotencyKey,
          p_snapshot: snapshot,
        })
      : await supabase.rpc("confirm_expense", {
          p_expense_id: parsed.data.expenseId,
          p_idempotency_key: parsed.data.idempotencyKey,
          p_snapshot: snapshot,
        });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("expense correction conflict") || msg.includes("submitted payment")) {
        const paymentId = extractBlockingPaymentId(error.message);
        return {
          ok: false,
          error: mapPaymentError(error.message).publicMessage,
          actionHref: paymentId
            ? `/app/${parsed.data.householdId}/money/payments/${paymentId}`
            : undefined,
          actionLabel: paymentId ? "Open blocking payment" : undefined,
        };
      }
      if (msg.includes("already confirmed")) {
        return { ok: false, error: "This expense was already confirmed." };
      }
      if (msg.includes("not reconciled") || msg.includes("mismatch")) {
        return { ok: false, error: "Expense reconciliation failed. Review allocations and try again." };
      }
      return { ok: false, error: "Unable to confirm expense." };
    }

    const { resolveActionNotifications } = await import(
      "@/lib/notifications/resolve-actions"
    );
    await resolveActionNotifications("expense", parsed.data.expenseId);

    revalidatePath(moneyPath(parsed.data.householdId));
    redirect(moneyPath(parsed.data.householdId, `/expenses/${parsed.data.expenseId}`));
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function deleteExpenseDraftAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = expenseIdSchema.safeParse({
      householdId: formData.get("householdId"),
      expenseId: formData.get("expenseId"),
    });
    if (!parsed.success) return { ok: false, error: "Invalid expense." };

    await assertActiveMembership(parsed.data.householdId);
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    await supabase.rpc("write_audit_event", {
      p_household_id: parsed.data.householdId,
      p_entity_type: "expense",
      p_entity_id: parsed.data.expenseId,
      p_event_type: "expense.draft_deleted",
      p_after_state: { status: "deleted" },
    });

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", parsed.data.expenseId)
      .eq("household_id", parsed.data.householdId)
      .in("status", ["draft", "ready_for_review"]);

    if (error) return { ok: false, error: "Unable to delete draft." };

    revalidatePath(moneyPath(parsed.data.householdId));
    redirect(moneyPath(parsed.data.householdId, "/expenses"));
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function voidExpenseAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = voidExpenseSchema.safeParse({
      householdId: formData.get("householdId"),
      expenseId: formData.get("expenseId"),
      reason: formData.get("reason"),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid void request." };
    }

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "expense.void")) {
      return { ok: false, error: "Not allowed to void expenses." };
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { error } = await supabase.rpc("void_expense", {
      p_expense_id: parsed.data.expenseId,
      p_reason: parsed.data.reason,
    });
    if (error) {
      const paymentId = extractBlockingPaymentId(error.message);
      return {
        ok: false,
        error: mapPaymentError(error.message).publicMessage,
        actionHref: paymentId
          ? `/app/${parsed.data.householdId}/money/payments/${paymentId}`
          : undefined,
        actionLabel: paymentId ? "Open blocking payment" : undefined,
      };
    }

    revalidatePath(moneyPath(parsed.data.householdId));
    redirect(moneyPath(parsed.data.householdId, `/expenses/${parsed.data.expenseId}`));
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function createExpenseAmendmentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = amendExpenseSchema.safeParse({
      householdId: formData.get("householdId"),
      expenseId: formData.get("expenseId"),
      reason: formData.get("reason"),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid amendment." };
    }

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "expense.amend")) {
      return { ok: false, error: "Not allowed to amend expenses." };
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("create_expense_amendment", {
      p_expense_id: parsed.data.expenseId,
      p_reason: parsed.data.reason,
    });
    if (error || !data) return { ok: false, error: "Unable to create amendment draft." };

    const amendmentId =
      typeof data === "object" && data && "id" in data
        ? String((data as { id: string }).id)
        : String(data);

    revalidatePath(moneyPath(parsed.data.householdId));
    redirect(moneyPath(parsed.data.householdId, `/expenses/${amendmentId}/edit`));
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function retagConfirmedExpenseItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = retagExpenseItemSchema.safeParse({
      householdId: formData.get("householdId"),
      expenseId: formData.get("expenseId"),
      itemId: formData.get("itemId"),
      allocationMode: formData.get("allocationMode"),
      personalMembershipId: formData.get("personalMembershipId") || null,
      membershipIdsJson: formData.get("membershipIdsJson") || "",
      idempotencyKey: formData.get("idempotencyKey"),
    });
    if (!parsed.success) {
      return {
        ok: false,
        error: humanizeExpenseValidationError(
          parsed.error,
          "Could not change who this item is tagged to.",
        ),
      };
    }

    const ctx = await assertActiveMembership(parsed.data.householdId);
    if (!can(ctx.roles, "expense.amend")) {
      return { ok: false, error: "Not allowed to change a submitted expense." };
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const original = await loadExpenseBundle(supabase, parsed.data.expenseId);
    if (!original || original.expense.household_id !== parsed.data.householdId) {
      return { ok: false, error: "Expense not found." };
    }
    if (original.expense.status !== "confirmed") {
      return { ok: false, error: "Only a submitted expense can be retagged this way." };
    }

    const sourceItem = original.items.find((item) => item.id === parsed.data.itemId);
    if (!sourceItem) return { ok: false, error: "Item not found." };

    const write = itemTagToWrite({
      allocationMode: parsed.data.allocationMode,
      personalMembershipId: parsed.data.personalMembershipId,
      membershipIds: parseMembershipIds(parsed.data.membershipIdsJson),
      payerMembershipId: original.expense.payer_membership_id,
    });
    if (write.allocationMode === "personal" && !write.personalMembershipId) {
      return { ok: false, error: "Choose who this item belongs to." };
    }
    if (write.allocationMode === "equal_selected" && write.participants.length === 0) {
      return { ok: false, error: "Choose at least one person to share this with." };
    }

    let amendmentId = await findDraftAmendmentExpenseId(
      supabase,
      parsed.data.expenseId,
    );
    if (!amendmentId) {
      const { data, error } = await supabase.rpc("create_expense_amendment", {
        p_expense_id: parsed.data.expenseId,
        p_reason: `Changed who pays for ${sourceItem.description}`,
      });
      if (error || !data) {
        amendmentId = await findDraftAmendmentExpenseId(
          supabase,
          parsed.data.expenseId,
        );
        if (!amendmentId) {
          return { ok: false, error: "Could not start a correction for that item." };
        }
      } else {
        amendmentId =
          typeof data === "object" && data && "id" in data
            ? String((data as { id: string }).id)
            : String(data);
      }
    }

    const draft = await loadExpenseBundle(supabase, amendmentId);
    if (!draft || draft.expense.household_id !== parsed.data.householdId) {
      return { ok: false, error: "Correction draft not found." };
    }
    if (draft.items.length !== original.items.length) {
      return {
        ok: false,
        error:
          "A larger correction is already in progress. Finish that first, then retag.",
      };
    }
    const draftItem = draft.items.find(
      (item) => item.display_order === sourceItem.display_order,
    );
    if (!draftItem) return { ok: false, error: "Could not find that item on the correction." };

    const { error: itemError } = await supabase
      .from("expense_items")
      .update({
        allocation_mode: write.allocationMode,
        personal_membership_id: write.personalMembershipId,
        classification: write.classification,
      })
      .eq("id", draftItem.id)
      .eq("expense_id", amendmentId);
    if (itemError) return { ok: false, error: "Could not update that item." };

    await supabase.from("expense_item_allocations").delete().eq("item_id", draftItem.id);
    if (write.participants.length > 0) {
      const { error: allocError } = await supabase.from("expense_item_allocations").insert(
        write.participants.map((p) => ({
          item_id: draftItem.id,
          expense_id: amendmentId,
          household_id: parsed.data.householdId,
          membership_id: p.membershipId,
          amount_cents: 0,
        })),
      );
      if (allocError) return { ok: false, error: "Could not save who is tagged." };
    }

    await syncLinkedReceiptLineTag(supabase, {
      householdId: parsed.data.householdId,
      expenseId: parsed.data.expenseId,
      displayOrder: sourceItem.display_order,
      description: sourceItem.description,
      classification: write.classification,
      participantMembershipIds: write.participants.map((p) => p.membershipId),
    });

    const fresh = await loadExpenseBundle(supabase, amendmentId);
    if (!fresh) return { ok: false, error: "Correction draft not found." };
    const calc = recalculateBundle(fresh);
    if (!calc.ok) return { ok: false, error: calc.message };

    const { error: confirmError } = await supabase.rpc("confirm_expense_amendment", {
      p_amendment_expense_id: amendmentId,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_snapshot: buildConfirmationSnapshot(calc),
    });
    if (confirmError) {
      const paymentId = extractBlockingPaymentId(confirmError.message);
      if (paymentId) {
        return {
          ok: false,
          error: mapPaymentError(confirmError.message).publicMessage,
          actionHref: `/app/${parsed.data.householdId}/money/payments/${paymentId}`,
          actionLabel: "Open blocking payment",
        };
      }
      return { ok: false, error: "Could not apply that change." };
    }

    revalidatePath(moneyPath(parsed.data.householdId));
    redirect(moneyPath(parsed.data.householdId, `/expenses/${amendmentId}`));
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

async function findDraftAmendmentExpenseId(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  originalExpenseId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("expense_amendments")
    .select("amendment_expense_id")
    .eq("original_expense_id", originalExpenseId)
    .eq("status", "draft")
    .maybeSingle();
  return data?.amendment_expense_id ?? null;
}

async function syncLinkedReceiptLineTag(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  input: {
    householdId: string;
    expenseId: string;
    displayOrder: number;
    description: string;
    classification: string;
    participantMembershipIds: string[];
  },
) {
  const { data: receipt } = await supabase
    .from("expense_receipts")
    .select("id")
    .eq("household_id", input.householdId)
    .eq("expense_id", input.expenseId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!receipt) return;

  const { data: lines } = await supabase
    .from("expense_receipt_line_items")
    .select("id, sort_index, corrected_name")
    .eq("receipt_id", receipt.id)
    .order("sort_index");
  const match =
    (lines ?? []).find((line) => line.sort_index === input.displayOrder) ??
    (lines ?? []).find((line) => line.corrected_name === input.description);
  if (!match) return;

  await supabase
    .from("expense_receipt_line_items")
    .update({
      classification: input.classification,
      participant_membership_ids:
        input.classification === "shared_household" || input.classification === "excluded"
          ? []
          : input.participantMembershipIds,
    })
    .eq("id", match.id);
}
