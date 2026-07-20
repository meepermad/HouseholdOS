import "server-only";

import { buildHouseholdArchive, archiveTableToCsv } from "./build-archive";

function asRecords(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data)) return [];
  return data as Record<string, unknown>[];
}

export async function processHouseholdExportJobs(options?: {
  batchSize?: number;
}): Promise<{ claimed: number; succeeded: number; failed: number }> {
  const { createPrivilegedClient } = await import("@/lib/supabase/privileged");
  const supabase = await createPrivilegedClient();

  const { data: jobs, error } = await supabase.rpc("claim_export_jobs", {
    p_batch_size: options?.batchSize ?? 2,
  });
  if (error || !jobs?.length) {
    return { claimed: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (const job of jobs as Array<{
    id: string;
    household_id: string;
    requested_by_membership_id: string;
  }>) {
    try {
      const householdId = job.household_id;
      const [
        household,
        members,
        expenses,
        chores,
        calendar,
        inventory,
        supplies,
        pantry,
        shopping,
        meals,
        recipes,
        maintenance,
        governance,
        polls,
        utilities,
      ] = await Promise.all([
        supabase.from("households").select("*").eq("id", householdId).single(),
        supabase
          .from("household_memberships")
          .select("id, user_id, status, created_at")
          .eq("household_id", householdId),
        supabase.from("expenses").select("*").eq("household_id", householdId),
        supabase
          .from("chore_definitions")
          .select("*")
          .eq("household_id", householdId),
        supabase
          .from("calendar_events")
          .select("*")
          .eq("household_id", householdId),
        supabase
          .from("inventory_items")
          .select("*")
          .eq("household_id", householdId),
        supabase.from("supply_items").select("*").eq("household_id", householdId),
        supabase.from("pantry_items").select("*").eq("household_id", householdId),
        supabase
          .from("shopping_list_items")
          .select("*")
          .eq("household_id", householdId),
        supabase.from("meal_requests").select("*").eq("household_id", householdId),
        supabase.from("recipes").select("*").eq("household_id", householdId),
        supabase
          .from("maintenance_requests")
          .select("*")
          .eq("household_id", householdId),
        supabase
          .from("governance_documents")
          .select("*")
          .eq("household_id", householdId),
        supabase.from("household_polls").select("*").eq("household_id", householdId),
        supabase
          .from("household_utilities")
          .select("*")
          .eq("household_id", householdId),
      ]);

      const archive = buildHouseholdArchive({
        householdId,
        household: (household.data ?? {}) as Record<string, unknown>,
        members: asRecords(members.data),
        expenses: asRecords(expenses.data),
        chores: asRecords(chores.data),
        calendar: asRecords(calendar.data),
        inventory: asRecords(inventory.data),
        supplies: asRecords(supplies.data),
        pantry: asRecords(pantry.data),
        shopping: asRecords(shopping.data),
        meals: asRecords(meals.data),
        recipes: asRecords(recipes.data),
        maintenance: asRecords(maintenance.data),
        governance: asRecords(governance.data),
        polls: asRecords(polls.data),
        utilities: asRecords(utilities.data),
        privacy: {
          canViewOthersPersonalPantry: false,
          canViewOthersPrivateRecipes: false,
          requesterMembershipId: job.requested_by_membership_id,
        },
      });

      const csvBundle = {
        expenses: archiveTableToCsv(archive.expenses),
        inventory: archiveTableToCsv(archive.inventory),
        pantry: archiveTableToCsv(archive.pantry),
      };
      const payload = JSON.stringify({ archive, csv: csvBundle });
      const storagePath = `${householdId}/${job.id}/export.json`;
      const { error: uploadError } = await supabase.storage
        .from("household-exports")
        .upload(storagePath, new TextEncoder().encode(payload), {
          contentType: "application/json",
          upsert: true,
        });
      if (uploadError) throw new Error(uploadError.message);

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.rpc("complete_export_job", {
        p_job_id: job.id,
        p_storage_path: storagePath,
        p_expires_at: expiresAt,
        p_result_meta: { bytes: payload.length },
      });
      succeeded += 1;
    } catch (e) {
      await supabase.rpc("complete_export_job", {
        p_job_id: job.id,
        // Ignored when p_error is set; required by generated Arg types.
        p_storage_path: "",
        p_expires_at: new Date(0).toISOString(),
        p_error: e instanceof Error ? e.message : "Export failed",
      });
      failed += 1;
    }
  }

  return { claimed: jobs.length, succeeded, failed };
}
