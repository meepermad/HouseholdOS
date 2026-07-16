"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { createSupplyItemAction } from "@/app/actions/house";
import { SUPPLY_CATEGORIES, SUPPLY_CATEGORY_LABELS } from "@/lib/house/categories";
import { SUPPLY_STOCK_LABELS } from "@/lib/house/display";
import { QUANTITY_UNITS, QUANTITY_UNIT_LABELS } from "@/lib/house/quantity";
import type { OwnershipMode, SupplyStockState } from "@/lib/house/types";
import { OwnershipSelect } from "./OwnershipSelect";

const SUPPLY_OWNERSHIP_MODES = ["household", "personal", "temporary", "unknown"] as const;
const STOCK_STATES = Object.keys(SUPPLY_STOCK_LABELS) as SupplyStockState[];

export function SupplyForm({
  householdId,
  members,
  locations,
}: {
  householdId: string;
  members: Array<{ id: string; label: string }>;
  locations: Array<{ id: string; name: string }>;
}) {
  const [ownershipMode, setOwnershipMode] = useState<OwnershipMode>("household");
  const needsOwner = ownershipMode === "personal" || ownershipMode === "temporary";

  return (
    <ActionForm action={createSupplyItemAction} className="space-y-4" pendingLabel="Adding supply…">
      <input type="hidden" name="householdId" value={householdId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input name="name" required maxLength={200} />
        </Field>
        <Field label="Category">
          <Select name="category" defaultValue="other">
            {SUPPLY_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {SUPPLY_CATEGORY_LABELS[category]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Stock state">
          <Select name="stockState" defaultValue="unknown">
            {STOCK_STATES.map((state) => (
              <option key={state} value={state}>
                {SUPPLY_STOCK_LABELS[state]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Restock policy">
          <Select name="restockPolicy" defaultValue="suggest">
            <option value="manual">Manual</option>
            <option value="suggest">Suggest when low</option>
            <option value="automatic">Automatic shopping add</option>
          </Select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Quantity" hint="Leave blank if approximate only">
          <Input name="quantity" type="text" inputMode="decimal" />
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Reorder threshold">
          <Input name="reorderThreshold" type="text" inputMode="decimal" />
        </Field>
        <Field label="Target quantity">
          <Input name="targetQuantity" type="text" inputMode="decimal" />
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
      <Field label="Responsible member">
        <Select name="responsibleMembershipId" defaultValue="">
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
      </Field>
      <fieldset className="space-y-3 rounded-md border border-border bg-surface p-4">
        <legend className="px-1 text-sm font-semibold">Ownership</legend>
        <OwnershipSelect value={ownershipMode} onChange={setOwnershipMode} modes={SUPPLY_OWNERSHIP_MODES} />
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
      </fieldset>
      <Field label="Notes">
        <Textarea name="notes" rows={2} maxLength={4000} />
      </Field>
      <SubmitButton>Add supply</SubmitButton>
    </ActionForm>
  );
}
