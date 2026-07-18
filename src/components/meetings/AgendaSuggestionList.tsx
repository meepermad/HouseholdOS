"use client";

import { useActionState } from "react";
import {
  acceptAgendaItemAction,
  dismissAgendaItemAction,
} from "@/app/actions/meetings";
import type { ActionResult } from "@/app/actions/auth";

type Item = {
  id: string;
  title: string;
  why_included: string | null;
  status: string;
  section_key: string;
};

function ItemActions({
  householdId,
  itemId,
}: {
  householdId: string;
  itemId: string;
}) {
  const [acceptState, acceptAction, acceptPending] = useActionState(
    acceptAgendaItemAction,
    null as ActionResult | null,
  );
  const [dismissState, dismissAction, dismissPending] = useActionState(
    dismissAgendaItemAction,
    null as ActionResult | null,
  );
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <form action={acceptAction}>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="itemId" value={itemId} />
        <button
          type="submit"
          disabled={acceptPending}
          className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm"
        >
          Accept
        </button>
      </form>
      <form action={dismissAction}>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="itemId" value={itemId} />
        <button
          type="submit"
          disabled={dismissPending}
          className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm"
        >
          Dismiss
        </button>
      </form>
      {acceptState && !acceptState.ok ? (
        <p className="text-xs text-danger">{acceptState.error}</p>
      ) : null}
      {dismissState && !dismissState.ok ? (
        <p className="text-xs text-danger">{dismissState.error}</p>
      ) : null}
    </div>
  );
}

export function AgendaSuggestionList({
  householdId,
  items,
}: {
  householdId: string;
  items: Item[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2" data-testid="suggested-agenda">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
        Suggested agenda
      </h2>
      <ul className="divide-y divide-border rounded-md border border-border bg-surface">
        {items.map((item) => (
          <li key={item.id} className="px-4 py-3.5 text-sm">
            <p className="font-medium">{item.title}</p>
            {item.why_included ? (
              <p className="mt-1 text-text-secondary">{item.why_included}</p>
            ) : null}
            <p className="mt-1 text-xs text-text-muted">
              {item.section_key.replaceAll("_", " ")} · {item.status}
            </p>
            {item.status === "proposed" ? (
              <ItemActions householdId={householdId} itemId={item.id} />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
