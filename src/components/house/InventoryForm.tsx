"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { MultiAssigneeSelector } from "@/components/chores/MultiAssigneeSelector";
import { createInventoryItemAction } from "@/app/actions/house";
import { INVENTORY_CATEGORIES, INVENTORY_CATEGORY_LABELS } from "@/lib/house/categories";
import { CONDITION_LABELS } from "@/lib/house/display";
import { OWNERSHIP_MODES } from "@/lib/house/ownership";
import { QUANTITY_UNITS, QUANTITY_UNIT_LABELS } from "@/lib/house/quantity";
import type { InventoryCondition, OwnershipMode } from "@/lib/house/types";
import { OwnershipSelect } from "./OwnershipSelect";

export function InventoryForm({
  householdId,
  members,
  locations,
}: {
  householdId: string;
  members: Array<{ id: string; label: string }>;
  locations: Array<{ id: string; name: string }>;
}) {
  const [ownershipMode, setOwnershipMode] = useState<OwnershipMode>("household");
  const [sharedMembers, setSharedMembers] = useState<string[]>([]);
  const needsOwner = ownershipMode === "personal" || ownershipMode === "temporary";
  const needsShared = ownershipMode === "shared_selected";

  return (
    <ActionForm action={createInventoryItemAction} className="space-y-5" pendingLabel="Adding item…">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="sharedMembershipIdsJson" value={JSON.stringify(sharedMembers)} />

      <Field label="Name">
        <Input name="name" required maxLength={200} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category">
          <Select name="category" defaultValue="other">
            {INVENTORY_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {INVENTORY_CATEGORY_LABELS[category]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Condition">
          <Select name="condition" defaultValue="unknown">
            {(Object.keys(CONDITION_LABELS) as InventoryCondition[]).map((condition) => (
              <option key={condition} value={condition}>
                {CONDITION_LABELS[condition]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Quantity">
          <Input name="quantity" type="text" inputMode="decimal" defaultValue="1" />
        </Field>
        <Field label="Unit">
          <Select name="quantityUnit" defaultValue="item">
            {QUANTITY_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {QUANTITY_UNIT_LABELS[unit]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Location">
        <Select name="locationId" defaultValue="">
          <option value="">No location</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </Select>
      </Field>
      <fieldset className="space-y-3 rounded-md border border-border bg-surface p-4">
        <legend className="px-1 text-sm font-semibold">Ownership</legend>
        <OwnershipSelect value={ownershipMode} onChange={setOwnershipMode} modes={OWNERSHIP_MODES} />
        {needsOwner ? (
          <Field label="Owner">
            <Select name="ownerMembershipId" defaultValue="">
              <option value="">Choose member</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {needsShared ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-text-primary">Shared with</p>
            <MultiAssigneeSelector members={members} value={sharedMembers} onChange={setSharedMembers} />
          </div>
        ) : null}
      </fieldset>
      <Field label="Description">
        <Textarea name="description" rows={3} maxLength={4000} />
      </Field>
      <SubmitButton>Add item</SubmitButton>
    </ActionForm>
  );
}
