"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { upsertExpenseItemAction } from "@/app/actions/expenses";
import type { MemberOption } from "@/lib/expenses/display";

const MODES = [
  { value: "personal", label: "Personal" },
  { value: "equal_all", label: "Equal (all)" },
  { value: "equal_selected", label: "Equal (selected)" },
  { value: "fixed_cents", label: "Fixed cents" },
  { value: "percentage", label: "Percentage" },
  { value: "weighted", label: "Weighted" },
  { value: "excluded", label: "Excluded" },
] as const;

type ItemDraft = {
  id?: string;
  description: string;
  quantityLabel: string;
  totalCents: number;
  allocationMode: string;
  personalMembershipId: string;
  selectedIds: string[];
  fixedMap: Record<string, number>;
  percentMap: Record<string, number>;
  weightMap: Record<string, number>;
  excludeFromBasis: boolean;
  displayOrder: number;
};

export function ExpenseItemEditor({
  householdId,
  expenseId,
  members,
  initial,
}: {
  householdId: string;
  expenseId: string;
  members: MemberOption[];
  initial?: Partial<ItemDraft> & { id?: string };
}) {
  const [mode, setMode] = useState(initial?.allocationMode ?? "equal_all");
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initial?.selectedIds ?? members.map((m) => m.id),
  );
  const [personalId, setPersonalId] = useState(
    initial?.personalMembershipId ?? members[0]?.id ?? "",
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

  const participantsJson = useMemo(() => {
    if (mode === "personal" || mode === "excluded" || mode === "equal_all") {
      return "[]";
    }
    const ids =
      mode === "equal_selected" ||
      mode === "fixed_cents" ||
      mode === "percentage" ||
      mode === "weighted"
        ? selectedIds
        : [];
    return JSON.stringify(
      ids.map((membershipId) => ({
        membershipId,
        fixedCents: fixedMap[membershipId],
        percentBps: percentMap[membershipId] !== undefined
          ? Math.round(percentMap[membershipId]! * 100)
          : undefined,
        weight: weightMap[membershipId],
      })),
    );
  }, [mode, selectedIds, fixedMap, percentMap, weightMap]);

  function toggleMember(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <ActionForm
      pendingLabel="Saving expense item…"
      action={upsertExpenseItemAction}
      className="space-y-3 rounded-md border border-line bg-surface p-3"
    >
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="expenseId" value={expenseId} />
      {initial?.id ? <input type="hidden" name="itemId" value={initial.id} /> : null}
      <input type="hidden" name="displayOrder" value={initial?.displayOrder ?? 0} />
      <input type="hidden" name="participantsJson" value={participantsJson} />

      <label className="block text-sm">
        Description
        <input
          name="description"
          required
          defaultValue={initial?.description ?? ""}
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm">
          Amount (cents)
          <input
            name="totalCents"
            type="number"
            min={0}
            required
            defaultValue={initial?.totalCents ?? 0}
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Qty note
          <input
            name="quantityLabel"
            defaultValue={initial?.quantityLabel ?? ""}
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2"
          />
        </label>
      </div>

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

      {mode === "personal" ? (
        <label className="block text-sm">
          Owner
          <select
            name="personalMembershipId"
            value={personalId}
            onChange={(e) => setPersonalId(e.target.value)}
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

      {mode === "excluded" ? (
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="excludeFromAdjustmentBasis"
            defaultChecked={initial?.excludeFromBasis}
          />
          Exclude from tax/tip proportional basis
        </label>
      ) : null}

      {(mode === "equal_selected" ||
        mode === "fixed_cents" ||
        mode === "percentage" ||
        mode === "weighted") && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Members</legend>
          {members.map((m) => (
            <div key={m.id} className="space-y-1 rounded border border-line/60 p-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(m.id)}
                  onChange={() => toggleMember(m.id)}
                />
                {m.label}
              </label>
              {selectedIds.includes(m.id) && mode === "fixed_cents" ? (
                <input
                  type="number"
                  placeholder="Cents"
                  className="w-full rounded-md border border-line px-2 py-1 text-sm"
                  value={fixedMap[m.id] ?? ""}
                  onChange={(e) =>
                    setFixedMap((prev) => ({
                      ...prev,
                      [m.id]: Number(e.target.value),
                    }))
                  }
                />
              ) : null}
              {selectedIds.includes(m.id) && mode === "percentage" ? (
                <input
                  type="number"
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
      )}

      <button
        type="submit"
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
      >
        {initial?.id ? "Update item" : "Add item"}
      </button>
    </ActionForm>
  );
}
