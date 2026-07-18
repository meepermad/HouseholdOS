"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureMonthlyMeetingAction } from "@/app/actions/meetings";
import type { ActionResult } from "@/app/actions/auth";

export function EnsureMeetingForm({
  householdId,
  periodStart,
  periodEnd,
}: {
  householdId: string;
  periodStart: string;
  periodEnd: string;
}) {
  const router = useRouter();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState(
    async (prev: ActionResult | null, formData: FormData) => {
      const result = await ensureMonthlyMeetingAction(prev, formData);
      if (result.ok && result.data?.meetingId) {
        router.push(`/app/${householdId}/meetings/${result.data.meetingId}`);
      }
      return result;
    },
    null,
  );

  return (
    <form action={action} className="space-y-2" data-testid="ensure-meeting-form">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="periodStart" value={periodStart} />
      <input type="hidden" name="periodEnd" value={periodEnd} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label className="block text-sm">
        Meeting date and time (optional)
        <input
          type="datetime-local"
          name="meetingAt"
          className="mt-1 block min-h-11 w-full rounded-md border border-border bg-input-bg px-2"
        />
      </label>
      {state && !state.ok ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        data-testid="prepare-monthly-review"
      >
        {pending ? "Creating…" : "Prepare monthly review"}
      </button>
    </form>
  );
}
