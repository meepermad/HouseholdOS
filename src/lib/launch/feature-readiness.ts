import "server-only";

import { createClient } from "@/lib/supabase/server";

export type LaunchFeatureKey =
  | "setup"
  | "receipts"
  | "importExport"
  | "comments";

export type LaunchFeatureReadiness = {
  setup: boolean;
  receipts: boolean;
  importExport: boolean;
  comments: boolean;
  /** True when every launch feature's DB objects are present. */
  allReady: boolean;
  /** Human-readable reason when any feature is missing. */
  missingMessage: string | null;
};

type ProbeResult = { ok: true } | { ok: false; missing: boolean; message: string };

function isMissingRelationError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("does not exist") ||
    lower.includes("could not find the table") ||
    lower.includes("schema cache") ||
    lower.includes("pgrst205") ||
    lower.includes("pgrst202")
  );
}

async function probeTable(table: string): Promise<ProbeResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from(table as "expense_receipts")
    .select("id")
    .limit(0);
  if (!error) return { ok: true };
  const message = error.message ?? "Unknown database error";
  if (isMissingRelationError(message)) {
    return {
      ok: false,
      missing: true,
      message: `Database object "${table}" is not available yet.`,
    };
  }
  return { ok: false, missing: false, message };
}

/**
 * Probe launch-phase tables. Does not swallow unexpected errors as "ready".
 * Missing relations → feature disabled. Other errors → feature disabled with message.
 */
export async function getLaunchFeatureReadiness(): Promise<LaunchFeatureReadiness> {
  const [setup, receipts, importBatches, comments] = await Promise.all([
    probeTable("household_setup_progress"),
    probeTable("expense_receipts"),
    probeTable("household_import_batches"),
    probeTable("record_comments"),
  ]);

  const readiness: LaunchFeatureReadiness = {
    setup: setup.ok,
    receipts: receipts.ok,
    importExport: importBatches.ok,
    comments: comments.ok,
    allReady: false,
    missingMessage: null,
  };
  readiness.allReady =
    readiness.setup &&
    readiness.receipts &&
    readiness.importExport &&
    readiness.comments;

  const missing: string[] = [];
  if (!readiness.setup) missing.push("setup");
  if (!readiness.receipts) missing.push("receipts");
  if (!readiness.importExport) missing.push("import/export");
  if (!readiness.comments) missing.push("comments");

  if (missing.length > 0) {
    const detail =
      [setup, receipts, importBatches, comments]
        .filter((r): r is Extract<ProbeResult, { ok: false }> => !r.ok)
        .map((r) => r.message)
        .find(Boolean) ?? "Launch database objects are not ready.";
    readiness.missingMessage = `Launch features unavailable (${missing.join(", ")}): ${detail} Apply production migrations, then retry.`;
  }

  return readiness;
}

export function launchFeatureUnavailableMessage(
  feature: LaunchFeatureKey,
  readiness: LaunchFeatureReadiness,
): string | null {
  if (readiness[feature]) return null;
  return (
    readiness.missingMessage ??
    `The ${feature} feature is not ready. Apply production migrations first.`
  );
}
