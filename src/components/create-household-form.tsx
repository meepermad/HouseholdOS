"use client";

import { useId, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { createHouseholdAction } from "@/app/actions/household";

export function CreateHouseholdForm({
  defaultName = "",
  defaultPropertyNickname = "",
  defaultTimezone,
  defaultCurrency,
}: {
  defaultName?: string;
  defaultPropertyNickname?: string;
  defaultTimezone: string;
  defaultCurrency: string;
}) {
  const formId = useId();
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  return (
    <ActionForm action={createHouseholdAction} className="space-y-3">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label className="block text-sm" htmlFor={`${formId}-name`}>
        Household name
        <input
          id={`${formId}-name`}
          name="name"
          required
          defaultValue={defaultName}
          className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
        />
      </label>
      <label className="block text-sm" htmlFor={`${formId}-nick`}>
        Property nickname (optional)
        <input
          id={`${formId}-nick`}
          name="propertyNickname"
          defaultValue={defaultPropertyNickname}
          className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm" htmlFor={`${formId}-lease-start`}>
          Lease start
          <input
            id={`${formId}-lease-start`}
            name="leaseStart"
            type="date"
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
          />
        </label>
        <label className="block text-sm" htmlFor={`${formId}-lease-end`}>
          Lease end
          <input
            id={`${formId}-lease-end`}
            name="leaseEnd"
            type="date"
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
          />
        </label>
      </div>
      <label className="block text-sm" htmlFor={`${formId}-tz`}>
        Timezone
        <input
          id={`${formId}-tz`}
          name="timezone"
          required
          defaultValue={defaultTimezone}
          className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
        />
      </label>
      <label className="block text-sm" htmlFor={`${formId}-currency`}>
        Currency
        <input
          id={`${formId}-currency`}
          name="currency"
          required
          defaultValue={defaultCurrency}
          pattern="[A-Za-z]{3}"
          className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
        />
      </label>
      <label className="block text-sm" htmlFor={`${formId}-threshold`}>
        Purchase approval threshold (dollars)
        <input
          id={`${formId}-threshold`}
          name="purchaseApprovalThresholdDollars"
          type="text"
          inputMode="decimal"
          required
          defaultValue="50.00"
          className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
        />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          name="acknowledgeReimbursementPolicy"
          type="checkbox"
          value="on"
          required
          className="mt-1"
        />
        <span>
          I acknowledge: one roommate pays shared purchases; HouseholdOS records
          reimbursement obligations and confirmations; payment happens outside the
          app; there is no joint household account.
        </span>
      </label>
      <button
        type="submit"
        className="w-full rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        Create household
      </button>
    </ActionForm>
  );
}
