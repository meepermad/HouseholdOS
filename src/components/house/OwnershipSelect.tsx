"use client";

import { Field, Select } from "@/components/ui/field";
import { OWNERSHIP_MODE_LABELS } from "@/lib/house/ownership";
import type { OwnershipMode } from "@/lib/house/types";

/** Simple ownership-mode select. Parent decides what else to show (owner picker, shared members). */
export function OwnershipSelect({
  name = "ownershipMode",
  label = "Ownership",
  value,
  onChange,
  modes,
}: {
  name?: string;
  label?: string;
  value: OwnershipMode;
  onChange: (mode: OwnershipMode) => void;
  modes?: readonly OwnershipMode[];
}) {
  const options = modes ?? (Object.keys(OWNERSHIP_MODE_LABELS) as OwnershipMode[]);
  return (
    <Field label={label}>
      <Select name={name} value={value} onChange={(e) => onChange(e.target.value as OwnershipMode)}>
        {options.map((mode) => (
          <option key={mode} value={mode}>
            {OWNERSHIP_MODE_LABELS[mode]}
          </option>
        ))}
      </Select>
    </Field>
  );
}
