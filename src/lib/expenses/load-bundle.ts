import { calculateExpense } from "@/lib/expenses";
import type {
  CalculateExpenseInput,
  CalculateExpenseResult,
  CalculateExpenseFailure,
} from "@/lib/expenses";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ExpenseDraftBundle = {
  expense: {
    id: string;
    household_id: string;
    created_by_membership_id: string;
    payer_membership_id: string;
    merchant: string;
    description: string;
    category: string | null;
    purchase_date: string;
    currency: string;
    declared_total_cents: number;
    calculated_subtotal_cents: number;
    calculated_adjustments_cents: number;
    status: string;
    confirmed_at: string | null;
    void_reason: string | null;
    voided_at: string | null;
    supersedes_expense_id: string | null;
    superseded_by_expense_id: string | null;
    created_at: string;
    updated_at: string;
  };
  items: Array<{
    id: string;
    description: string;
    quantity_label: string | null;
    total_cents: number;
    display_order: number;
    allocation_mode: string;
    personal_membership_id: string | null;
    exclude_from_adjustment_basis: boolean;
    allocations: Array<{
      membership_id: string;
      amount_cents: number;
      fixed_cents: number | null;
      percent_bps: number | null;
      weight: number | null;
    }>;
  }>;
  adjustments: Array<{
    id: string;
    adjustment_type: string;
    description: string;
    amount_cents: number;
    allocation_mode: string;
    assigned_membership_id: string | null;
    display_order: number;
    allocations: Array<{
      membership_id: string;
      amount_cents: number;
      fixed_cents: number | null;
      percent_bps: number | null;
      weight: number | null;
    }>;
  }>;
  eligibleMembershipIds: string[];
  householdCurrency: string;
};

export async function loadExpenseBundle(
  supabase: Supabase,
  expenseId: string,
): Promise<ExpenseDraftBundle | null> {
  const { data: expense, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", expenseId)
    .maybeSingle();
  if (error || !expense) return null;

  const [{ data: household }, { data: items }, { data: adjustments }, { data: memberships }] =
    await Promise.all([
      supabase.from("households").select("currency").eq("id", expense.household_id).single(),
      supabase
        .from("expense_items")
        .select("*")
        .eq("expense_id", expenseId)
        .order("display_order", { ascending: true }),
      supabase
        .from("expense_adjustments")
        .select("*")
        .eq("expense_id", expenseId)
        .order("display_order", { ascending: true }),
      supabase
        .from("household_memberships")
        .select("id")
        .eq("household_id", expense.household_id)
        .eq("status", "active"),
    ]);

  const itemIds = (items ?? []).map((i) => i.id);
  const adjustmentIds = (adjustments ?? []).map((a) => a.id);

  const [{ data: itemAllocs }, { data: adjAllocs }] = await Promise.all([
    itemIds.length
      ? supabase.from("expense_item_allocations").select("*").in("item_id", itemIds)
      : Promise.resolve({ data: [] as never[] }),
    adjustmentIds.length
      ? supabase
          .from("expense_adjustment_allocations")
          .select("*")
          .in("adjustment_id", adjustmentIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  return {
    expense,
    items: (items ?? []).map((item) => ({
      ...item,
      allocations: (itemAllocs ?? []).filter((a) => a.item_id === item.id),
    })),
    adjustments: (adjustments ?? []).map((adj) => ({
      ...adj,
      allocations: (adjAllocs ?? []).filter((a) => a.adjustment_id === adj.id),
    })),
    eligibleMembershipIds: (memberships ?? []).map((m) => m.id),
    householdCurrency: household?.currency ?? expense.currency,
  };
}

export function bundleToCalcInput(bundle: ExpenseDraftBundle): CalculateExpenseInput {
  return {
    payerMembershipId: bundle.expense.payer_membership_id,
    eligibleMembershipIds: bundle.eligibleMembershipIds,
    currency: bundle.expense.currency,
    householdCurrency: bundle.householdCurrency,
    declaredTotalCents: bundle.expense.declared_total_cents,
    items: bundle.items.map((item) => ({
      id: item.id,
      description: item.description,
      totalCents: item.total_cents,
      allocationMode: item.allocation_mode as CalculateExpenseInput["items"][number]["allocationMode"],
      personalMembershipId: item.personal_membership_id ?? undefined,
      excludeFromAdjustmentBasis: item.exclude_from_adjustment_basis,
      participants: item.allocations.map((a) => ({
        membershipId: a.membership_id,
        fixedCents: a.fixed_cents ?? undefined,
        percentBps: a.percent_bps ?? undefined,
        weight: a.weight ?? undefined,
      })),
    })),
    adjustments: bundle.adjustments.map((adj) => ({
      id: adj.id,
      description: adj.description,
      type: adj.adjustment_type as CalculateExpenseInput["adjustments"][number]["type"],
      amountCents: adj.amount_cents,
      allocationMode:
        adj.allocation_mode as CalculateExpenseInput["adjustments"][number]["allocationMode"],
      assignedMembershipId: adj.assigned_membership_id ?? undefined,
      participants: adj.allocations.map((a) => ({
        membershipId: a.membership_id,
        fixedCents: a.fixed_cents ?? undefined,
        percentBps: a.percent_bps ?? undefined,
        weight: a.weight ?? undefined,
      })),
    })),
  };
}

export function recalculateBundle(
  bundle: ExpenseDraftBundle,
): CalculateExpenseResult | CalculateExpenseFailure {
  return calculateExpense(bundleToCalcInput(bundle));
}

export function buildConfirmationSnapshot(result: CalculateExpenseResult) {
  const itemAllocations: Array<{
    item_id: string;
    membership_id: string;
    amount_cents: number;
  }> = [];
  const adjustmentAllocations: Array<{
    adjustment_id: string;
    membership_id: string;
    amount_cents: number;
  }> = [];

  for (const line of result.lines) {
    for (const alloc of line.allocations) {
      if (line.sourceType === "item") {
        itemAllocations.push({
          item_id: line.sourceId,
          membership_id: alloc.membershipId,
          amount_cents: alloc.amountCents,
        });
      } else {
        adjustmentAllocations.push({
          adjustment_id: line.sourceId,
          membership_id: alloc.membershipId,
          amount_cents: alloc.amountCents,
        });
      }
    }
  }

  return {
    calculated_subtotal_cents: result.itemSubtotalCents,
    calculated_adjustments_cents: result.adjustmentsNetCents,
    item_allocations: itemAllocations,
    adjustment_allocations: adjustmentAllocations,
    obligations: result.obligations.map((o) => ({
      debtor_membership_id: o.debtorMembershipId,
      creditor_membership_id: o.creditorMembershipId,
      amount_cents: o.amountCents,
    })),
  };
}
