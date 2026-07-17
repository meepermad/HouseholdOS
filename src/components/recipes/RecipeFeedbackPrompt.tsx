"use client";

import { ActionForm } from "@/components/action-form";
import {
  dismissRecipeFeedbackAction,
  submitRecipeFeedbackAction,
} from "@/app/actions/meals";
import { FavoriteToggle } from "@/components/recipes/FavoriteToggle";

const MAKE_AGAIN_OPTIONS = [
  { signal: "would_make_again", label: "Yes" },
  { signal: "okay", label: "Maybe" },
  { signal: "would_not_choose_again", label: "No" },
] as const;

export function RecipeFeedbackPrompt({
  householdId,
  feedbackRequestId,
  recipeName,
  allowDismiss = true,
}: {
  householdId: string;
  feedbackRequestId: string;
  recipeName?: string | null;
  allowDismiss?: boolean;
}) {
  return (
    <section
      className="space-y-3 rounded-md border border-border bg-surface p-4"
      aria-labelledby="recipe-feedback-heading"
    >
      <header className="space-y-1">
        <h2 id="recipe-feedback-heading" className="font-semibold text-text-primary">
          Optional recipe feedback
        </h2>
        <p className="text-sm text-text-secondary">
          {recipeName
            ? `Would you make “${recipeName}” again?`
            : "Would you make this meal again?"}
        </p>
      </header>

      <ActionForm
        action={submitRecipeFeedbackAction}
        pendingLabel="Saving feedback…"
        className="space-y-3"
      >
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="feedbackRequestId" value={feedbackRequestId} />

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-text-primary">
            Would make again
          </legend>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Would make again">
            {MAKE_AGAIN_OPTIONS.map((option) => (
              <button
                key={option.signal}
                type="submit"
                name="preferenceSignal"
                value={option.signal}
                className="min-h-11 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <FavoriteToggle />
      </ActionForm>

      {allowDismiss ? (
        <ActionForm
          action={dismissRecipeFeedbackAction}
          pendingLabel="Dismissing…"
          className="pt-1"
        >
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="feedbackRequestId" value={feedbackRequestId} />
          <button
            type="submit"
            className="min-h-11 text-sm text-text-secondary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Not now
          </button>
        </ActionForm>
      ) : null}
    </section>
  );
}
