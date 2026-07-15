"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { switchHouseholdAction } from "@/app/actions/household";

export function HouseholdSwitcher({
  householdId,
  households,
  compact = false,
}: {
  householdId: string;
  households: { id: string; name: string }[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div
      className={
        compact
          ? "border-b border-border px-3 py-2 lg:border-b-0 lg:px-0"
          : "border-b border-border px-4 py-2"
      }
    >
      <label
        htmlFor="household-switcher"
        className="text-xs font-medium uppercase tracking-wide text-text-muted"
      >
        Current household
      </label>
      <select
        id="household-switcher"
        name="householdId"
        value={householdId}
        disabled={pending}
        aria-busy={pending || undefined}
        className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2 text-sm text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-60"
        onChange={(event) => {
          const nextId = event.target.value;
          const formData = new FormData();
          formData.set("householdId", nextId);
          startTransition(async () => {
            await switchHouseholdAction(null, formData);
            router.push(`/app/${nextId}`);
            router.refresh();
          });
        }}
      >
        {households.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>
      {pending ? (
        <p className="mt-1 text-xs text-text-muted" aria-live="polite">
          Switching household…
        </p>
      ) : null}
    </div>
  );
}
