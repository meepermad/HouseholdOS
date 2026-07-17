import { ActionForm } from "@/components/action-form";
import { setAwayStatusAction } from "@/app/actions/coordination";
import { assertActiveMembership } from "@/lib/household-context";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

export default async function AwayStatusPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 3);
  const toLocal = (d: Date) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);

  return (
    <main className="app-form-route space-y-4" data-testid="away-status-form">
      <h1 className="font-[family-name:var(--font-display)] text-2xl">
        Away status
      </h1>
      <p className="text-sm text-text-secondary">
        Set temporary availability for chores and meals. HouseholdOS never
        tracks your location. Shared expense obligations are unchanged.
      </p>
      <ActionForm
        action={setAwayStatusAction}
        className="space-y-4"
        pendingLabel="Saving away status…"
      >
        <input type="hidden" name="householdId" value={householdId} />
        <Field label="Away from">
          <Input
            type="datetime-local"
            name="startsAt"
            required
            defaultValue={toLocal(start)}
          />
        </Field>
        <Field label="Away until">
          <Input
            type="datetime-local"
            name="endsAt"
            required
            defaultValue={toLocal(end)}
          />
        </Field>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="unavailableForChores" defaultChecked />{" "}
          Unavailable for chores
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="excludeFromMealHeadcounts"
            defaultChecked
          />{" "}
          Exclude from default meal headcounts
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="stillParticipatesInExpenses"
            defaultChecked
          />{" "}
          Still participating in shared expenses
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="reduceNonurgentNotifications"
            defaultChecked
          />{" "}
          Reduce nonurgent notifications
        </label>
        <Field label="Optional note">
          <Textarea name="note" rows={2} maxLength={500} />
        </Field>
        <SubmitButton>Save away status</SubmitButton>
      </ActionForm>
    </main>
  );
}
