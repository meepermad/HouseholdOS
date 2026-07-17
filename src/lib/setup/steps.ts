export type SetupStepStatus = "pending" | "skipped" | "completed";

export type SetupStepKey =
  | "basics"
  | "invites"
  | "responsibilities"
  | "utilities"
  | "policy"
  | "chores"
  | "pantry_supplies"
  | "property"
  | "guests"
  | "notifications"
  | "review";

export type SetupStepDef = {
  key: SetupStepKey;
  title: string;
  description: string;
  whyItMatters: string;
  /** Deep link into a full domain page for advanced configuration. */
  advancedHref?: (householdId: string) => string;
};

export const SETUP_STEPS: readonly SetupStepDef[] = [
  {
    key: "basics",
    title: "Household basics",
    description: "Confirm the household name and timezone.",
    whyItMatters: "Everyone sees the same household identity and schedule context.",
  },
  {
    key: "invites",
    title: "Invite roommates",
    description: "Send invites so others can join with the right roles.",
    whyItMatters: "Shared expenses and chores only work once members are present.",
  },
  {
    key: "responsibilities",
    title: "Assign responsibilities",
    description: "Pick who owns kitchen, trash, utilities, and more.",
    whyItMatters: "Clear ownership reduces forgotten shared work.",
  },
  {
    key: "utilities",
    title: "Rent and utilities",
    description: "Add recurring rent and utility reminders.",
    whyItMatters: "Due dates stay visible before bills become overdue.",
  },
  {
    key: "policy",
    title: "Purchase policy",
    description: "Confirm how shared purchases and reimbursements work.",
    whyItMatters: "Agreed rules prevent surprise obligations.",
  },
  {
    key: "chores",
    title: "Chore rotations",
    description: "Create an initial rotation for recurring chores.",
    whyItMatters: "Fair rotation keeps recurring work moving without debate.",
  },
  {
    key: "pantry_supplies",
    title: "Pantry and supplies",
    description: "Seed common pantry staples and household supplies.",
    whyItMatters: "Shared stock visibility stops duplicate trips and empty shelves.",
  },
  {
    key: "property",
    title: "Household property",
    description: "Add important durable items you share or track.",
    whyItMatters: "Ownership and condition notes help with moves and repairs.",
  },
  {
    key: "guests",
    title: "Guest expectations",
    description: "Point everyone at guest notices and calendar norms.",
    whyItMatters: "Overnight guests and quiet hours work better when expected.",
  },
  {
    key: "notifications",
    title: "Enable notifications",
    description: "Turn on push so chores, payments, and guests reach you.",
    whyItMatters: "Action items arrive on your phone instead of getting buried.",
  },
  {
    key: "review",
    title: "Review setup",
    description: "Confirm what you finished and what you skipped.",
    whyItMatters: "You can return later for anything left incomplete.",
  },
] as const;

export type StepProgress = {
  status: SetupStepStatus;
  updatedAt?: string;
  draft?: unknown;
};

export type SetupProgressState = {
  steps: Partial<Record<SetupStepKey, StepProgress>>;
  dismissedAt: string | null;
  completedAt: string | null;
  currentStep: SetupStepKey | null;
};

export function countCompleted(steps: SetupProgressState["steps"]): number {
  return SETUP_STEPS.filter((s) => steps[s.key]?.status === "completed").length;
}

export function countSkipped(steps: SetupProgressState["steps"]): number {
  return SETUP_STEPS.filter((s) => steps[s.key]?.status === "skipped").length;
}

export function countDone(steps: SetupProgressState["steps"]): number {
  return SETUP_STEPS.filter((s) => {
    const status = steps[s.key]?.status;
    return status === "completed" || status === "skipped";
  }).length;
}

export function progressPercent(steps: SetupProgressState["steps"]): number {
  return Math.round((countDone(steps) / SETUP_STEPS.length) * 100);
}

/** Home reminder: visible until dismissed or fully completed. */
export function isSetupReminderVisible(progress: SetupProgressState): boolean {
  if (progress.dismissedAt || progress.completedAt) return false;
  return countDone(progress.steps) < SETUP_STEPS.length;
}

export function nextIncompleteStep(
  steps: SetupProgressState["steps"],
): SetupStepKey {
  for (const step of SETUP_STEPS) {
    const status = steps[step.key]?.status;
    if (status !== "completed" && status !== "skipped") {
      return step.key;
    }
  }
  return "review";
}

export function parseStepsJson(raw: unknown): SetupProgressState["steps"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: SetupProgressState["steps"] = {};
  for (const step of SETUP_STEPS) {
    const entry = (raw as Record<string, unknown>)[step.key];
    if (!entry || typeof entry !== "object") continue;
    const status = (entry as { status?: string }).status;
    if (status === "pending" || status === "skipped" || status === "completed") {
      out[step.key] = {
        status,
        updatedAt: (entry as { updatedAt?: string }).updatedAt,
        draft: (entry as { draft?: unknown }).draft,
      };
    }
  }
  return out;
}
