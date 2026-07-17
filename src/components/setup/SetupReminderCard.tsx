import Link from "next/link";
import { dismissSetupAction } from "@/app/actions/setup";
import { progressPercent, type SetupProgressState } from "@/lib/setup/steps";
import { ActionForm } from "@/components/action-form";

type Props = {
  householdId: string;
  progress: SetupProgressState;
};

export function SetupReminderCard({ householdId, progress }: Props) {
  const percent = progressPercent(progress.steps);
  return (
    <section
      className="rounded-md border border-border bg-surface px-4 py-3"
      data-testid="setup-reminder"
      aria-labelledby="setup-reminder-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="setup-reminder-heading"
            className="text-sm font-semibold text-text-primary"
          >
            Finish household setup
          </h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            Optional guided checklist — {percent}% done. Skip anytime.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/app/${householdId}/setup`}
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
          >
            Continue
          </Link>
          <ActionForm action={dismissSetupAction}>
            <input type="hidden" name="householdId" value={householdId} />
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm"
            >
              Dismiss
            </button>
          </ActionForm>
        </div>
      </div>
    </section>
  );
}
