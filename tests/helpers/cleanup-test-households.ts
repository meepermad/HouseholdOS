import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Deletes households whose names contain the test-run id via the privileged
 * cleanup RPC (service_role + transaction GUC). Safe for Phase 3 immutability gates.
 */
export async function cleanupTestHouseholdsByRunId(
  admin: SupabaseClient,
  runId: string,
): Promise<number> {
  const { data, error } = await admin.rpc("cleanup_test_household_data", {
    p_test_run_id: runId,
  });
  if (error) throw error;
  return typeof data === "number" ? data : Number(data ?? 0);
}

export async function deleteTestAuthUsers(
  admin: SupabaseClient,
  userIds: string[],
): Promise<void> {
  for (const userId of userIds) {
    await admin.from("user_preferences").delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
}
