"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/app/actions/auth";
import { assertActiveMembership } from "@/lib/household-context";
import { logServerError, toPublicErrorMessage } from "@/lib/errors";
import {
  candidateToReviewPayload,
  RECIPE_IMPORT_PARSER_VERSION,
  redactUrlForLog,
  runRecipeImportPipeline,
  safeHostnameForLog,
  warningMessages,
} from "@/lib/meals/import";
import {
  assertRobotsAllowed,
  fetchRecipePage,
  ImportFailure,
  isImportFailure,
  validateUrlForFetch,
} from "@/lib/meals/import/server";
import { can, type Capability } from "@/lib/permissions";
import {
  cancelRecipeImportSchema,
  requestRecipeImportSchema,
  saveRecipeImportSchema,
} from "@/lib/validations/meals";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;

const str = (value: FormDataEntryValue | null) => String(value ?? "").trim();
const optional = (value: FormDataEntryValue | null) => str(value) || null;
const bool = (value: FormDataEntryValue | null) =>
  value === "true" || value === "on";

function invalidate(householdId: string) {
  revalidatePath(`/app/${householdId}/recipes`);
  revalidatePath(`/app/${householdId}/meals`);
}

async function context(householdId: string, capability: Capability) {
  const ctx = await assertActiveMembership(householdId);
  if (!can(ctx.roles, capability)) {
    throw new Error("You are not allowed to perform this meal action.");
  }
  const { createClient } = await import("@/lib/supabase/server");
  return { ctx, supabase: (await createClient()) as UntypedDb };
}

function publicImportError(error: unknown): string {
  if (isImportFailure(error)) {
    return failureMessage(error.category);
  }
  const message = error instanceof Error ? error.message : "";
  if (/import limit/i.test(message)) {
    return "Import limit reached. Try again later.";
  }
  if (/already exists/i.test(message)) {
    return "An imported recipe from this source already exists.";
  }
  if (/private|not available|expired/i.test(message)) {
    return "This import draft is no longer available.";
  }
  return toPublicErrorMessage(error);
}

function failureMessage(category: string): string {
  const messages: Record<string, string> = {
    invalid_url: "That URL is not a valid public HTTP or HTTPS address.",
    blocked_destination:
      "For safety, HouseholdOS cannot connect to that destination.",
    robots_disallowed:
      "The source site does not permit automated recipe retrieval.",
    fetch_timeout: "The source did not respond within the import time limit.",
    response_too_large: "The source page is too large to import safely.",
    unsupported_content_type: "The source did not return an HTML page.",
    http_error: "The source site returned an error.",
    rate_limited:
      "The source or HouseholdOS import limit was reached. Try again later.",
    no_recipe_found: "No reliable recipe data was found on that page.",
    multiple_recipes_found: "Multiple recipes were found on that page.",
    invalid_structured_data: "The page's recipe markup could not be used.",
    parser_failure: "The page could not be parsed safely.",
    login_required: "The recipe requires a source-site login.",
    paywall_or_access_denied: "The source page is not publicly accessible.",
  };
  return messages[category] ?? "The page could not be imported safely.";
}

export async function requestRecipeImportAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  let draftId: string | null = null;
  let householdId = "";
  try {
    const parsed = requestRecipeImportSchema.safeParse({
      householdId: str(formData.get("householdId")),
      sourceUrl: str(formData.get("sourceUrl")),
      refreshRecipeId: optional(formData.get("refreshRecipeId")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    householdId = d.householdId;
    const { supabase } = await context(d.householdId, "meal.create");

    const validated = await validateUrlForFetch(d.sourceUrl);
    const hostname = validated.hostname;

    const { data: createdDraftId, error: createError } = await supabase.rpc(
      "create_recipe_import_draft",
      {
        p_household_id: d.householdId,
        p_source_url: validated.url.toString(),
        p_source_hostname: hostname,
        p_parser_version: RECIPE_IMPORT_PARSER_VERSION,
        p_refresh_recipe_id: d.refreshRecipeId ?? null,
      },
    );
    if (createError) return { ok: false, error: publicImportError(createError) };
    draftId = String(createdDraftId);

    await assertRobotsAllowed(validated.url);
    const fetched = await fetchRecipePage(validated.url);
    const pipeline = runRecipeImportPipeline({
      html: fetched.body,
      sourceUrl: validated.url.toString(),
      finalUrl: fetched.finalUrl,
    });

    if (pipeline.candidates.length === 0) {
      await supabase.rpc("complete_recipe_import_draft", {
        p_draft_id: draftId,
        p_status: "failed",
        p_failure_category: "no_recipe_found",
        p_canonical_url: pipeline.canonicalUrl,
        p_warnings: pipeline.warnings,
        p_confidence: pipeline.confidence,
      });
      redirect(`/app/${d.householdId}/recipes/import/${draftId}`);
    }

    if (pipeline.candidates.length > 1) {
      await supabase.rpc("complete_recipe_import_draft", {
        p_draft_id: draftId,
        p_status: "needs_review",
        p_candidates: pipeline.candidates.map(candidateToReviewPayload),
        p_warnings: warningMessages(pipeline.warnings),
        p_confidence: pipeline.confidence,
        p_strategy: pipeline.strategy,
        p_canonical_url: pipeline.canonicalUrl,
        p_content_hash: pipeline.contentHash,
        p_failure_category: "multiple_recipes_found",
      });
      redirect(`/app/${d.householdId}/recipes/import/${draftId}`);
    }

    const primary = pipeline.primary!;
    const payload = candidateToReviewPayload(primary);
    await supabase.rpc("complete_recipe_import_draft", {
      p_draft_id: draftId,
      p_status: "needs_review",
      p_payload: payload,
      p_candidates: [],
      p_warnings: warningMessages(pipeline.warnings),
      p_confidence: pipeline.confidence,
      p_strategy: pipeline.strategy,
      p_canonical_url: pipeline.canonicalUrl,
      p_source_title: payload.name,
      p_source_author: payload.author,
      p_source_image_url: payload.imageUrl,
      p_content_hash: pipeline.contentHash,
    });

    redirect(`/app/${d.householdId}/recipes/import/${draftId}`);
  } catch (error) {
    if ((error as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    logServerError("recipe.import", error, {
      householdId,
      host: safeHostnameForLog(str(formData.get("sourceUrl"))),
      url: redactUrlForLog(str(formData.get("sourceUrl"))),
      category: isImportFailure(error) ? error.category : "unexpected",
    });
    if (draftId && householdId) {
      try {
        const { createClient } = await import("@/lib/supabase/server");
        const supabase = (await createClient()) as UntypedDb;
        await supabase.rpc("complete_recipe_import_draft", {
          p_draft_id: draftId,
          p_status: "failed",
          p_failure_category: isImportFailure(error)
            ? error.category
            : "parser_failure",
        });
        redirect(`/app/${householdId}/recipes/import/${draftId}`);
      } catch (redirectOrError) {
        if (
          (redirectOrError as { digest?: string })?.digest?.startsWith(
            "NEXT_REDIRECT",
          )
        ) {
          throw redirectOrError;
        }
      }
    }
    return { ok: false, error: publicImportError(error) };
  }
}

export async function selectImportCandidateAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const householdId = str(formData.get("householdId"));
    const draftId = str(formData.get("draftId"));
    const candidateIndex = Number(str(formData.get("candidateIndex")) || "0");
    const { supabase } = await context(householdId, "meal.create");
    const { data: draft, error } = await supabase
      .from("recipe_import_drafts")
      .select("*")
      .eq("id", draftId)
      .eq("household_id", householdId)
      .maybeSingle();
    if (error || !draft) return { ok: false, error: "Import draft not found." };
    const candidates = Array.isArray(draft.candidate_payloads)
      ? draft.candidate_payloads
      : [];
    const selected = candidates[candidateIndex];
    if (!selected) return { ok: false, error: "Select a valid recipe candidate." };
    const { error: updateError } = await supabase.rpc(
      "complete_recipe_import_draft",
      {
        p_draft_id: draftId,
        p_status: "needs_review",
        p_payload: selected,
        p_candidates: candidates,
        p_warnings: draft.validation_warnings ?? [],
        p_confidence: draft.confidence_summary ?? {},
        p_strategy: draft.extraction_strategy,
        p_canonical_url: draft.canonical_url,
        p_source_title: selected.name ?? draft.source_title,
        p_source_author: selected.author ?? draft.source_author,
        p_source_image_url: selected.imageUrl ?? draft.source_image_url,
        p_content_hash: draft.content_hash,
      },
    );
    if (updateError) return { ok: false, error: publicImportError(updateError) };
    redirect(`/app/${householdId}/recipes/import/${draftId}`);
  } catch (error) {
    if ((error as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    return { ok: false, error: publicImportError(error) };
  }
}

export async function saveImportedRecipeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = saveRecipeImportSchema.safeParse({
      householdId: str(formData.get("householdId")),
      draftId: str(formData.get("draftId")),
      recipeJson: str(formData.get("recipeJson")),
      visibility: str(formData.get("visibility")) || "household",
      importAsCopy: bool(formData.get("importAsCopy")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "meal.create");
    let recipe: Record<string, unknown>;
    try {
      recipe = JSON.parse(d.recipeJson) as Record<string, unknown>;
    } catch {
      return { ok: false, error: "Recipe review payload is invalid." };
    }
    if (!String(recipe.name ?? "").trim()) {
      return { ok: false, error: "Recipe name is required." };
    }

    const { data: recipeId, error } = await supabase.rpc("save_imported_recipe", {
      p_draft_id: d.draftId,
      p_recipe: recipe,
      p_visibility: d.visibility,
      p_import_as_copy: d.importAsCopy,
    });
    if (error) return { ok: false, error: publicImportError(error) };
    invalidate(d.householdId);
    redirect(`/app/${d.householdId}/recipes/${recipeId}`);
  } catch (error) {
    if ((error as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    return { ok: false, error: publicImportError(error) };
  }
}

export async function cancelRecipeImportAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = cancelRecipeImportSchema.safeParse({
      householdId: str(formData.get("householdId")),
      draftId: str(formData.get("draftId")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
    }
    const d = parsed.data;
    const { supabase } = await context(d.householdId, "meal.create");
    const { error } = await supabase.rpc("cancel_recipe_import_draft", {
      p_draft_id: d.draftId,
    });
    if (error) return { ok: false, error: publicImportError(error) };
    invalidate(d.householdId);
    redirect(`/app/${d.householdId}/recipes`);
  } catch (error) {
    if ((error as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    return { ok: false, error: publicImportError(error) };
  }
}

export async function refreshRecipeSourceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  formData.set("refreshRecipeId", str(formData.get("recipeId")));
  return requestRecipeImportAction(_prev, formData);
}
