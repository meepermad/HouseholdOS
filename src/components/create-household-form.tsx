"use client";

import { useId } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
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
  // Idempotency key is generated server-side when omitted (avoids SSR/hydration mismatch).

  return (
    <ActionForm
      action={createHouseholdAction}
      className="space-y-3"
      pendingLabel="Creating household…"
    >
      <label className="block text-sm text-text-primary" htmlFor={`${formId}-name`}>
        Household name
        <input
          id={`${formId}-name`}
          name="name"
          required
          defaultValue={defaultName}
          className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2"
        />
      </label>
      <label className="block text-sm text-text-primary" htmlFor={`${formId}-nick`}>
        Property nickname (optional)
        <input
          id={`${formId}-nick`}
          name="propertyNickname"
          defaultValue={defaultPropertyNickname}
          className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2"
        />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm text-text-primary" htmlFor={`${formId}-lease-start`}>
          Lease start
          <input
            id={`${formId}-lease-start`}
            name="leaseStart"
            type="date"
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2"
          />
        </label>
        <label className="block text-sm text-text-primary" htmlFor={`${formId}-lease-end`}>
          Lease end
          <input
            id={`${formId}-lease-end`}
            name="leaseEnd"
            type="date"
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2"
          />
        </label>
      </div>
      <label className="block text-sm text-text-primary" htmlFor={`${formId}-tz`}>
        Timezone
        <input
          id={`${formId}-tz`}
          name="timezone"
          required
          defaultValue={defaultTimezone}
          className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2"
        />
      </label>
      <label className="block text-sm text-text-primary" htmlFor={`${formId}-currency`}>
        Currency
        <input
          id={`${formId}-currency`}
          name="currency"
          required
          defaultValue={defaultCurrency}
          pattern="[A-Za-z]{3}"
          className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2"
        />
      </label>
      <label className="block text-sm text-text-primary" htmlFor={`${formId}-threshold`}>
        Purchase approval threshold (dollars)
        <input
          id={`${formId}-threshold`}
          name="purchaseApprovalThresholdDollars"
          type="text"
          inputMode="decimal"
          required
          defaultValue="50.00"
          className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2"
        />
      </label>
      <label className="flex items-start gap-2 text-sm text-text-secondary">
        <input
          name="acknowledgeReimbursementPolicy"
          type="checkbox"
          value="on"
          required
          className="mt-1 size-4"
        />
        <span>
          I acknowledge: one roommate pays shared purchases; HouseholdOS records
          reimbursement obligations and confirmations; payment happens outside the
          app; there is no joint household account.
        </span>
      </label>
      <SubmitButton pendingLabel="Creating household…" className="w-full">
        Create household
      </SubmitButton>
    </ActionForm>
  );
}
