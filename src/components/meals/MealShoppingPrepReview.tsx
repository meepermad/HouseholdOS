"use client";

import { ActionForm } from "@/components/action-form";
import { confirmMealShoppingAction } from "@/app/actions/meals";

const LINE_LABELS: Record<string, string> = {
  available: "Available",
  probably_available: "Probably available",
  insufficient_quantity: "Insufficient quantity",
  missing: "Missing",
  already_on_shopping_list: "Already on shopping list",
  optional: "Optional",
  needs_unit_review: "Needs unit review",
  unavailable_personal_item: "Unavailable personal item",
};

export type ShoppingPrepLineView = {
  id: string;
  display_name: string;
  line_status: string;
  shortfall_quantity: number | string | null;
  quantity_unit: string;
  excluded: boolean;
};

export function MealShoppingPrepReview({
  householdId,
  proposalId,
  lines,
  policy,
}: {
  householdId: string;
  proposalId: string;
  lines: ShoppingPrepLineView[];
  policy: string;
}) {
  return (
    <section className="space-y-4" aria-labelledby="shopping-prep-heading">
      <header>
        <h2 id="shopping-prep-heading" className="text-xl font-semibold">
          Shopping preparation
        </h2>
        <p className="text-sm text-text-secondary">
          Policy: {policy.replaceAll("_", " ")}. Review shortfalls before adding
          to the shopping list. Status is labeled in text, not color alone.
        </p>
      </header>

      <ActionForm
        action={confirmMealShoppingAction}
        pendingLabel="Adding ingredients to shopping…"
        className="space-y-4"
      >
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="proposalId" value={proposalId} />
        <input type="hidden" name="excludedLineIdsJson" value="[]" id="excluded-json" />

        <ul className="divide-y divide-border rounded-md border border-border">
          {lines.map((line) => (
            <li
              key={line.id}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-text-primary">{line.display_name}</p>
                <p className="text-sm text-text-secondary">
                  <span className="sr-only">Status: </span>
                  {LINE_LABELS[line.line_status] ?? line.line_status}
                  {line.shortfall_quantity != null
                    ? ` · shortfall ${line.shortfall_quantity} ${line.quantity_unit}`
                    : null}
                </p>
              </div>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={`exclude-${line.id}`}
                  defaultChecked={line.excluded}
                  className="size-4"
                  aria-label={`Exclude ${line.display_name} from shopping`}
                />
                Exclude
              </label>
            </li>
          ))}
        </ul>

        <button
          type="submit"
          className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          onClick={(e) => {
            const form = (e.target as HTMLElement).closest("form");
            if (!form) return;
            const excluded: string[] = [];
            for (const line of lines) {
              const cb = form.querySelector(
                `input[name="exclude-${line.id}"]`,
              ) as HTMLInputElement | null;
              if (cb?.checked) excluded.push(line.id);
            }
            const hidden = form.querySelector(
              "#excluded-json",
            ) as HTMLInputElement | null;
            if (hidden) hidden.value = JSON.stringify(excluded);
          }}
        >
          Confirm proposed additions
        </button>
      </ActionForm>
    </section>
  );
}
