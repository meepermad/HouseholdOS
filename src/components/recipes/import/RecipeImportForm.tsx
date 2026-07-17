"use client";

import { requestRecipeImportAction } from "@/app/actions/recipe-import";
import { ActionForm } from "@/components/action-form";

export function RecipeImportForm({ householdId }: { householdId: string }) {
  return (
    <ActionForm
      action={requestRecipeImportAction}
      pendingLabel="Securely importing…"
      className="space-y-4"
    >
      <input type="hidden" name="householdId" value={householdId} />
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Recipe URL</span>
        <input
          name="sourceUrl"
          type="url"
          inputMode="url"
          required
          autoComplete="url"
          placeholder="https://example.com/recipe"
          className="min-h-12 w-full rounded-md border border-border bg-surface px-3"
        />
      </label>
      <p className="text-sm text-text-secondary">
        HouseholdOS fetches one public HTML page. It will not sign in, bypass a
        paywall, follow recipe links, or save anything until you review it.
      </p>
      <button
        type="submit"
        className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
      >
        Import for review
      </button>
    </ActionForm>
  );
}
