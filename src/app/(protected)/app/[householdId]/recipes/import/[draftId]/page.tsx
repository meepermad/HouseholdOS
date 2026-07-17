import Link from "next/link";
import { notFound } from "next/navigation";
import {
  cancelRecipeImportAction,
  selectImportCandidateAction,
} from "@/app/actions/recipe-import";
import { AppBackButton } from "@/components/app-back-button";
import { ActionForm } from "@/components/action-form";
import { ImportReviewForm } from "@/components/recipes/import/ImportReviewForm";
import { assertActiveMembership } from "@/lib/household-context";
import {
  findRecipeImportDuplicates,
  getRecipeImportDraft,
} from "@/lib/meals/queries";

export const dynamic = "force-dynamic";

export default async function RecipeImportReviewPage({
  params,
}: {
  params: Promise<{ householdId: string; draftId: string }>;
}) {
  const { householdId, draftId } = await params;
  await assertActiveMembership(householdId);
  const draft = await getRecipeImportDraft(householdId, draftId);
  if (!draft) notFound();

  const candidates = Array.isArray(draft.candidate_payloads)
    ? draft.candidate_payloads
    : [];
  const payload = draft.extracted_payload as Record<string, unknown> | null;
  const warnings = Array.isArray(draft.validation_warnings)
    ? draft.validation_warnings.map(String)
    : [];

  if (draft.status === "failed") {
    return (
      <main className="space-y-5">
        <AppBackButton fallbackHref={`/app/${householdId}/recipes/import`} />
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Import could not be completed
        </h1>
        <p className="max-w-xl text-text-secondary">
          {failureMessage(String(draft.failure_category ?? "parser_failure"))}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/app/${householdId}/recipes/new`}
            className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Enter recipe manually
          </Link>
          <a
            href={String(draft.source_url)}
            rel="noopener noreferrer"
            target="_blank"
            className="min-h-11 rounded-md border border-border px-4 py-2.5 text-sm font-medium"
          >
            Open source page
          </a>
        </div>
      </main>
    );
  }

  if (!payload && candidates.length > 1) {
    return (
      <main className="space-y-5">
        <AppBackButton fallbackHref={`/app/${householdId}/recipes/import`} />
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Choose the recipe to import
        </h1>
        <p className="text-sm text-text-secondary">
          This page contains more than one structured recipe.
        </p>
        <div className="space-y-3">
          {candidates.map((candidate: Record<string, unknown>, index: number) => (
            <ActionForm
              key={`${String(candidate.name)}-${index}`}
              action={selectImportCandidateAction}
              pendingLabel="Preparing review…"
              className="flex items-center justify-between gap-4 border-b border-border py-3"
            >
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="draftId" value={draftId} />
              <input type="hidden" name="candidateIndex" value={index} />
              <span className="font-medium">
                {String(candidate.name ?? `Recipe ${index + 1}`)}
              </span>
              <button
                type="submit"
                className="min-h-11 rounded-md border border-border px-3 text-sm font-medium"
              >
                Review this recipe
              </button>
            </ActionForm>
          ))}
        </div>
      </main>
    );
  }

  if (!payload) notFound();
  const duplicates = await findRecipeImportDuplicates(
    householdId,
    draft.canonical_url,
    draft.content_hash,
  );
  const duplicate = duplicates[0]
    ? { id: String(duplicates[0].id), name: String(duplicates[0].name) }
    : null;

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/recipes/import`} />
      <header className="space-y-1">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Review imported recipe
        </h1>
        <p className="text-sm text-text-secondary">
          Extraction method:{" "}
          {String(draft.extraction_strategy ?? "manual").replaceAll("_", " ")}
        </p>
      </header>
      <ImportReviewForm
        householdId={householdId}
        draftId={draftId}
        initialRecipe={payload}
        warnings={warnings}
        sourceHostname={String(draft.source_hostname)}
        duplicate={duplicate}
      />
      <ActionForm
        action={cancelRecipeImportAction}
        pendingLabel="Cancelling…"
      >
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="draftId" value={draftId} />
        <button type="submit" className="min-h-11 text-sm font-medium text-destructive underline">
          Cancel import
        </button>
      </ActionForm>
    </main>
  );
}

function failureMessage(category: string) {
  const messages: Record<string, string> = {
    invalid_url: "That URL is not a valid public HTTP or HTTPS address.",
    blocked_destination: "For safety, HouseholdOS cannot connect to that destination.",
    robots_disallowed: "The source site does not permit automated recipe retrieval.",
    fetch_timeout: "The source did not respond within the import time limit.",
    response_too_large: "The source page is too large to import safely.",
    unsupported_content_type: "The source did not return an HTML page.",
    http_error: "The source site returned an error.",
    rate_limited: "The source or HouseholdOS import limit was reached. Try again later.",
    no_recipe_found: "No reliable recipe data was found on that page.",
    login_required: "The recipe requires a source-site login.",
    paywall_or_access_denied: "The source page is not publicly accessible.",
  };
  return messages[category] ?? "The page could not be parsed safely.";
}
