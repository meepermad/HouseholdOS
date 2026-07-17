"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/auth";
import { assertActiveMembership } from "@/lib/household-context";
import { toPublicErrorMessage } from "@/lib/errors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;

export async function requestHouseholdExportAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult & { jobId?: string }> {
  try {
    const householdId = String(formData.get("householdId") ?? "");
    const ctx = await assertActiveMembership(householdId);
    if (!ctx.roles.includes("household_coordinator")) {
      return { ok: false, error: "Only coordinators can export household data." };
    }
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = (await createClient()) as UntypedDb;
    const { data: jobId, error } = await supabase.rpc("request_household_export", {
      p_household_id: householdId,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/app/${householdId}/settings/export`);
    return {
      ok: true,
      message: "Export queued. This is a backup archive, not a full database restore.",
      jobId: String(jobId),
    };
  } catch (e) {
    return { ok: false, error: toPublicErrorMessage(e) };
  }
}
