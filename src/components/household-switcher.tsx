"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { switchHouseholdAction } from "@/app/actions/household";

export function HouseholdSwitcher({
  householdId,
  households,
}: {
  householdId: string;
  households: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="border-b border-line px-4 py-2">
      <label htmlFor="household-switcher" className="text-xs uppercase tracking-wide text-slate-500">
        Current household
      </label>
      <select
        id="household-switcher"
        name="householdId"
        value={householdId}
        disabled={pending}
        className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
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
    </div>
  );
}
