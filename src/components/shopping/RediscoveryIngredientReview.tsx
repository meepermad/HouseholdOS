"use client";

import { ActionForm } from "@/components/action-form";
import { confirmRediscoveryIngredientsAction } from "@/app/actions/shopping-intel";

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

export type RediscoveryIngredientLineView = {
  id: string;
  displayName: string;
  lineStatus: string;
  shortfallQuantity: string | number | null;
  quantityUnit: string;
  excluded: boolean;
  unitMismatch: boolean;
  required: boolean;
};

export function RediscoveryIngredientReview({
  householdId,
  proposalId,
  lines,
  householdName,
  recipeName,
}: {
  householdId: string;
  proposalId: string;
  lines: RediscoveryIngredientLineView[];
  householdName: string;
  recipeName: string;
}) {
  return (
    <section
      className="space-y-4"
      aria-labelledby="rediscovery-ingredients-heading"
      data-testid="rediscovery-ingredient-review"
    >
      <header>
        <p className="text-xs text-text-muted" data-testid="household-context-label">
          Household: {householdName}
        </p>
        <h2
          id="rediscovery-ingredients-heading"
          className="text-xl font-semibold text-text-primary"
        >
          Missing ingredients for {recipeName}
        </h2>
        <p className="text-sm text-text-secondary">
          Recalculated against current pantry and shopping list. Nothing is added
          until you confirm. Review-first — meal shopping-prep auto policies do not
          apply to Forgotten Favorites.
        </p>
      </header>

      <ActionForm
        action={confirmRediscoveryIngredientsAction}
        pendingLabel="Adding confirmed ingredients…"
        className="space-y-4"
      >
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="proposalId" value={proposalId} />
        <input
          type="hidden"
          name="excludedLineIdsJson"
          value="[]"
          id="rediscovery-excluded-json"
        />

        <ul className="divide-y divide-border rounded-md border border-border">
          {lines.map((line) => (
            <li
              key={line.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              data-testid="rediscovery-ingredient-line"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-text-primary">
                  {line.displayName}
                  {!line.required ? (
                    <span className="ml-2 text-xs text-text-muted">optional</span>
                  ) : null}
                </p>
                <p className="text-sm text-text-secondary">
                  <span className="sr-only">Status: </span>
                  {LINE_LABELS[line.lineStatus] ?? line.lineStatus}
                  {line.unitMismatch ? " · unit needs review" : null}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs text-text-muted">
                  Qty
                  <input
                    name={`qty-${line.id}`}
                    type="number"
                    step="any"
                    defaultValue={
                      line.shortfallQuantity != null
                        ? String(line.shortfallQuantity)
                        : undefined
                    }
                    className="ml-1 min-h-11 w-20 rounded-md border border-border bg-background px-2 text-sm"
                    aria-label={`Quantity for ${line.displayName}`}
                    data-testid="ingredient-qty"
                  />
                  <span className="ml-1">{line.quantityUnit}</span>
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={`exclude-${line.id}`}
                    defaultChecked={line.excluded}
                    className="size-4"
                    aria-label={`Exclude ${line.displayName}`}
                    data-testid="exclude-ingredient"
                  />
                  Exclude
                </label>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="submit"
          className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          data-testid="confirm-rediscovery-ingredients"
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
              "#rediscovery-excluded-json",
            ) as HTMLInputElement | null;
            if (hidden) hidden.value = JSON.stringify(excluded);
          }}
        >
          Confirm selected ingredients
        </button>
      </ActionForm>
    </section>
  );
}
