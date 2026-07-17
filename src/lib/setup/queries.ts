import { assertActiveMembership } from "@/lib/household-context";
import {
  isSetupReminderVisible,
  parseStepsJson,
  type SetupProgressState,
  type SetupStepKey,
} from "@/lib/setup/steps";
import { createClient } from "@/lib/supabase/server";

export async function loadSetupProgress(
  householdId: string,
): Promise<SetupProgressState | null> {
  await assertActiveMembership(householdId);
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("ensure_household_setup_progress", {
      p_household_id: householdId,
    });
    if (error || !data) return null;
    return {
      steps: parseStepsJson(data.steps),
      dismissedAt: data.dismissed_at ?? null,
      completedAt: data.completed_at ?? null,
      currentStep: (data.current_step as SetupStepKey | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function loadSetupReminder(
  householdId: string,
): Promise<SetupProgressState | null> {
  const progress = await loadSetupProgress(householdId);
  if (!progress || !isSetupReminderVisible(progress)) return null;
  return progress;
}
