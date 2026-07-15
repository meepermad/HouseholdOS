"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { upsertExpenseAdjustmentAction } from "@/app/actions/expenses";
import type { MemberOption } from "@/lib/expenses/display";

const TYPES = [
  "tax",
  "tip",
  "delivery_fee",
  "service_fee",
  "discount",
  "coupon",
  "store_credit",
  "other",
] as const;

const MODES = [
  { value: "proportional", label: "Proportional to items" },
  { value: "equal_all", label: "Equal (all)" },
  { value: "equal_selected", label: "Equal (selected)" },
  { value: "fixed_cents", label: "Fixed cents" },
  { value: "percentage", label: "Percentage" },
  { value: "weighted", label: "Weighted" },
  { value: "payer_absorbs", label: "Payer absorbs" },
  { value: "assigned", label: "Assigned to one" },
] as const;

export function ExpenseAdjustmentEditor({
  householdId,
  expenseId,
  members,
  initial,
}: {
  householdId: string;
  expenseId: string;
  members: MemberOption[];
  initial?: {
    id?: string;
    adjustmentType?: string;
    description?: string;
    amountCents?: number;
    allocationMode?: string;
    assignedMembershipId?: string;
    selectedIds?: string[];
    displayOrder?: number;
  };
}) {
  const [mode, setMode] = useState(initial?.allocationMode ?? "proportional");
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initial?.selectedIds ?? members.map((m) => m.id),
  );
  const [assignedId, setAssignedId] = useState(
    initial?.assignedMembershipId ?? members[0]?.id ?? "",
  );

  const participantsJson = useMemo(() => {
    if (
      mode === "proportional" ||
      mode === "equal_all" ||
      mode === "payer_absorbs" ||
      mode === "assigned"
    ) {
      return "[]";
    }
    return JSON.stringify(selectedIds.map((membershipId) => ({ membershipId })));
  }, [mode, selectedIds]);

  return (
    <ActionForm
      action={upsertExpenseAdjustmentAction}
      className="space-y-3 rounded-md border border-border bg-surface p-4"
      pendingLabel="Saving adjustment…"
    >
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="expenseId" value={expenseId} />
      {initial?.id ? (
        <input type="hidden" name="adjustmentId" value={initial.id} />
      ) : null}
      <input type="hidden" name="displayOrder" value={initial?.displayOrder ?? 0} />
      <input type="hidden" name="participantsJson" value={participantsJson} />

      <label className="block text-sm">
        Type
        <select
          name="adjustmentType"
          defaultValue={initial?.adjustmentType ?? "tax"}
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        Description
        <input
          name="description"
          required
          defaultValue={initial?.description ?? ""}
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        Amount (cents, negative for discounts)
        <input
          name="amountCents"
          type="number"
          required
          defaultValue={initial?.amountCents ?? 0}
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        Allocation
        <select
          name="allocationMode"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2"
        >
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      {mode === "assigned" ? (
        <label className="block text-sm">
          Member
          <select
            name="assignedMembershipId"
            value={assignedId}
            onChange={(e) => setAssignedId(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {(mode === "equal_selected" ||
        mode === "fixed_cents" ||
        mode === "percentage" ||
        mode === "weighted") && (
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">Members</legend>
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedIds.includes(m.id)}
                onChange={() =>
                  setSelectedIds((prev) =>
                    prev.includes(m.id)
                      ? prev.filter((x) => x !== m.id)
                      : [...prev, m.id],
                  )
                }
              />
              {m.label}
            </label>
          ))}
        </fieldset>
      )}

      <button
        type="submit"
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
      >
        {initial?.id ? "Update adjustment" : "Add adjustment"}
      </button>
    </ActionForm>
  );
}
