"use client";

import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { markSupplyLowAction, restockSupplyItemAction } from "@/app/actions/house";

const secondaryClass =
  "min-h-11 rounded-md border border-border px-3 text-sm font-semibold hover:bg-surface-interactive";

/** Mark low / restock controls for a supply item. Large touch targets for quick shelf checks. */
export function StockStateControl({
  householdId,
  itemId,
  quantityUnit,
}: {
  householdId: string;
  itemId: string;
  quantityUnit: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <ActionForm action={markSupplyLowAction} pendingLabel="Marking low…">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="itemId" value={itemId} />
        <button type="submit" className={secondaryClass}>
          Mark low
        </button>
      </ActionForm>
      <ActionForm action={restockSupplyItemAction} className="flex flex-wrap items-end gap-2" pendingLabel="Restocking…">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="stockState" value="in_stock" />
        <label className="text-sm text-text-secondary">
          <span className="sr-only">Restock quantity ({quantityUnit})</span>
          <Input
            name="quantity"
            type="text"
            inputMode="decimal"
            placeholder={`Qty (${quantityUnit})`}
            className="w-28"
          />
        </label>
        <SubmitButton>Restock</SubmitButton>
      </ActionForm>
    </div>
  );
}
