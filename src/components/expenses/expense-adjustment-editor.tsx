"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { upsertExpenseAdjustmentAction } from "@/app/actions/expenses";
import { CurrencyAmountInput, CurrencyField } from "@/components/ui/currency-field";
import {
  adjustmentAllocationLabel,
  adjustmentTypeLabel,
  type MemberOption,
} from "@/lib/expenses/display";

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
  "proportional",
  "equal_all",
  "equal_selected",
  "fixed_cents",
  "percentage",
  "weighted",
  "payer_absorbs",
  "assigned",
] as const;

const DEFAULT_MODE = "proportional";

const MEMBER_INPUT_MODES = ["fixed_cents", "percentage", "weighted"] as const;

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
    fixedMap?: Record<string, number>;
    percentMap?: Record<string, number>;
    weightMap?: Record<string, number>;
    displayOrder?: number;
  };
}) {
  const [mode, setMode] = useState(initial?.allocationMode ?? DEFAULT_MODE);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initial?.selectedIds ?? members.map((m) => m.id),
  );
  const [assignedId, setAssignedId] = useState(
    initial?.assignedMembershipId ?? members[0]?.id ?? "",
  );
  const [fixedMap, setFixedMap] = useState<Record<string, number>>(
    initial?.fixedMap ?? {},
  );
  const [percentMap, setPercentMap] = useState<Record<string, number>>(
    initial?.percentMap ?? {},
  );
  const [weightMap, setWeightMap] = useState<Record<string, number>>(
    initial?.weightMap ?? {},
  );
  const [showSplit, setShowSplit] = useState(
    (initial?.allocationMode ?? DEFAULT_MODE) !== DEFAULT_MODE,
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
    return JSON.stringify(
      selectedIds.map((membershipId) => {
        if (mode === "equal_selected") {
          return { membershipId };
        }
        return {
          membershipId,
          ...(mode === "fixed_cents" && fixedMap[membershipId] !== undefined
            ? { fixedCents: fixedMap[membershipId] }
            : {}),
          ...(mode === "percentage" && percentMap[membershipId] !== undefined
            ? { percentBps: Math.round(percentMap[membershipId]! * 100) }
            : {}),
          ...(mode === "weighted" && weightMap[membershipId] !== undefined
            ? { weight: weightMap[membershipId] }
            : {}),
        };
      }),
    );
  }, [mode, selectedIds, fixedMap, percentMap, weightMap]);

  function toggleMember(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const splitSummary =
    mode === "assigned"
      ? `Charged to ${members.find((m) => m.id === assignedId)?.label ?? "one person"}`
      : adjustmentAllocationLabel(mode);

  const showMemberInputs =
    mode === "equal_selected" ||
    (MEMBER_INPUT_MODES as readonly string[]).includes(mode);

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
      {!showSplit ? (
        <input type="hidden" name="allocationMode" value={mode} />
      ) : null}

      <label className="block text-sm">
        Type
        <select
          name="adjustmentType"
          defaultValue={initial?.adjustmentType ?? "tax"}
          className="mt-1 w-full rounded-md border border-line bg-input-bg px-3 py-2"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {adjustmentTypeLabel(t)}
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
          className="mt-1 w-full rounded-md border border-line bg-input-bg px-3 py-2"
        />
      </label>

      <CurrencyField
        label="Amount"
        name="amountCents"
        defaultCents={initial?.amountCents ?? 0}
        allowNegative
        required
        hint="Use a negative amount for discounts and credits."
      />

      <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
        <p
          className="text-sm text-text-secondary"
          data-testid="adjustment-split-summary"
        >
          {splitSummary}
        </p>
        {showSplit ? null : (
          <button
            type="button"
            onClick={() => setShowSplit(true)}
            className="min-h-11 shrink-0 text-sm font-medium text-primary underline-offset-2 hover:underline"
            data-testid="adjustment-split-change"
          >
            Change
          </button>
        )}
      </div>

      {showSplit ? (
        <div className="space-y-3" data-testid="adjustment-split-controls">
          <label className="block text-sm">
            Allocation
            <select
              name="allocationMode"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-input-bg px-3 py-2"
            >
              {MODES.map((value) => (
                <option key={value} value={value}>
                  {adjustmentAllocationLabel(value)}
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
                className="mt-1 w-full rounded-md border border-line bg-input-bg px-3 py-2"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {showMemberInputs ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Members</legend>
              {members.map((m) => (
                <div key={m.id} className="space-y-2 rounded-md border border-border p-3">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(m.id)}
                      onChange={() => toggleMember(m.id)}
                    />
                    {m.label}
                  </label>
                  {selectedIds.includes(m.id) && mode === "fixed_cents" ? (
                    <CurrencyAmountInput
                      ariaLabel={`Amount for ${m.label}`}
                      allowNegative
                      valueCents={fixedMap[m.id]}
                      onChangeCents={(cents) =>
                        setFixedMap((prev) => {
                          if (cents === undefined) {
                            const next = { ...prev };
                            delete next[m.id];
                            return next;
                          }
                          return { ...prev, [m.id]: cents };
                        })
                      }
                    />
                  ) : null}
                  {selectedIds.includes(m.id) && mode === "percentage" ? (
                    <input
                      type="number"
                      aria-label={`Percentage for ${m.label}`}
                      placeholder="% (e.g. 25)"
                      className="w-full rounded-md border border-line px-2 py-1 text-sm"
                      value={percentMap[m.id] ?? ""}
                      onChange={(e) =>
                        setPercentMap((prev) => ({
                          ...prev,
                          [m.id]: Number(e.target.value),
                        }))
                      }
                    />
                  ) : null}
                  {selectedIds.includes(m.id) && mode === "weighted" ? (
                    <input
                      type="number"
                      aria-label={`Shares for ${m.label}`}
                      placeholder="Shares"
                      min={1}
                      className="w-full rounded-md border border-line px-2 py-1 text-sm"
                      value={weightMap[m.id] ?? ""}
                      onChange={(e) =>
                        setWeightMap((prev) => ({
                          ...prev,
                          [m.id]: Number(e.target.value),
                        }))
                      }
                    />
                  ) : null}
                </div>
              ))}
            </fieldset>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
      >
        {initial?.id ? "Update adjustment" : "Add adjustment"}
      </button>
    </ActionForm>
  );
}
