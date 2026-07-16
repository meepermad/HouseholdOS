"use client";

import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { createShoppingItemAction } from "@/app/actions/house";

/** Fast single-field add, meant for grocery-trip use: name in, item added, form resets. */
export function ShoppingQuickAdd({
  householdId,
  listId,
}: {
  householdId: string;
  listId: string;
}) {
  return (
    <ActionForm action={createShoppingItemAction} className="flex flex-wrap items-end gap-2" pendingLabel="Adding…">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="listId" value={listId} />
      <label className="flex-1">
        <span className="sr-only">Add an item</span>
        <Input name="name" required maxLength={200} placeholder="Add an item…" aria-label="Item name" />
      </label>
      <SubmitButton>Add</SubmitButton>
    </ActionForm>
  );
}
