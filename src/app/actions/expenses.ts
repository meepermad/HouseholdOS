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
import { can } from "@/lib/permissions";
import {
  buildConfirmationSnapshot,
  loadExpenseBundle,
  recalculateBundle,
} from "@/lib/expenses/load-bundle";
import {
  amendExpenseSchema,
  confirmExpenseSchema,
  createExpenseDraftSchema,
  deleteExpenseAdjustmentSchema,
  deleteExpenseItemSchema,
  expenseIdSchema,
  submitExpenseReviewSchema,
  updateExpenseHeaderSchema,
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
    return parsed;
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
      excludeFromAdjustmentBasis: formData.get("excludeFromAdjustmentBasis"),
      participants: parseParticipants(formData),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid line item." };
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
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid adjustment." };
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
