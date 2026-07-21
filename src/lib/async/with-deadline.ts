import { AppError } from "@/lib/errors";

export type LoadStage =
  | "profile"
  | "household_shell"
  | "home"
  | "app";

const STAGE_LABEL: Record<LoadStage, string> = {
  profile: "Profile setup",
  household_shell: "Household shell",
  home: "Home data",
  app: "Application",
};

export function loadStageLabel(stage: LoadStage): string {
  return STAGE_LABEL[stage];
}

export function deadlineMessage(stage: LoadStage): string {
  return `${STAGE_LABEL[stage]} timed out. Retry, reload the latest version, or sign out.`;
}

/**
 * Reject if `promise` does not settle within `ms`.
 * Does not cancel the underlying work; it only bounds what the UI waits on.
 */
export async function withDeadline<T>(
  promise: Promise<T>,
  options: { ms: number; stage: LoadStage },
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new AppError("database_failure", deadlineMessage(options.stage)));
        }, options.ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Layout / profile gates — keep under the 7s client recovery budget. */
export const LAYOUT_DEADLINE_MS = 6_000;

/** Home action-center pack. */
export const HOME_DEADLINE_MS = 6_500;
