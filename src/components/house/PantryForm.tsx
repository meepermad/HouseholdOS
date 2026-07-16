"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { createPantryItemAction } from "@/app/actions/house";
import { PANTRY_CATEGORIES, PANTRY_CATEGORY_LABELS } from "@/lib/house/categories";
import { QUANTITY_UNITS, QUANTITY_UNIT_LABELS } from "@/lib/house/quantity";
import type { OwnershipMode } from "@/lib/house/types";
import { OwnershipSelect } from "./OwnershipSelect";

const PANTRY_OWNERSHIP_MODES = ["household", "personal", "temporary", "unknown"] as const;

export function PantryForm({
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
    <ActionForm action={createPantryItemAction} className="space-y-4" pendingLabel="Adding pantry item…">
      <input type="hidden" name="householdId" value={householdId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input name="name" required maxLength={200} />
        </Field>
        <Field label="Category">
          <Select name="category" defaultValue="other">
            {PANTRY_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {PANTRY_CATEGORY_LABELS[category]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Quantity" hint="Leave blank if unknown">
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Use soon by" hint="Nudges a friendly reminder">
          <Input name="useSoonAt" type="date" />
        </Field>
        <Field label="Entered use-by / best-by date" hint="Review before use — no food-safety claim">
          <Input name="useBy" type="date" />
        </Field>
      </div>
      <fieldset className="space-y-3 rounded-md border border-border bg-surface p-4">
        <legend className="px-1 text-sm font-semibold">Ownership</legend>
        <OwnershipSelect value={ownershipMode} onChange={setOwnershipMode} modes={PANTRY_OWNERSHIP_MODES} />
        {needsOwner ? (
          <Field label="Owner" hint="Personal pantry notes stay private to the owner">
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
      <SubmitButton>Add pantry item</SubmitButton>
    </ActionForm>
  );
}
