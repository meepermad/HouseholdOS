import { ActionForm } from "@/components/action-form";
import { createPollAction } from "@/app/actions/ux-c";
import { assertActiveMembership } from "@/lib/household-context";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

export default async function NewPollPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);

  return (
    <main className="app-form-route space-y-4" data-testid="poll-form">
      <h1 className="font-[family-name:var(--font-display)] text-2xl">
        Household decision
      </h1>
      <p className="text-sm text-text-secondary">
        Lightweight poll for roommate coordination. Results never automatically
        change expenses, governance, or permissions.
      </p>
      <ActionForm
        action={createPollAction}
        className="space-y-4"
        pendingLabel="Publishing poll…"
      >
        <input type="hidden" name="householdId" value={householdId} />
        <Field label="Question" required>
          <Input name="question" required maxLength={500} />
        </Field>
        <Field
          label="Options"
          hint="One option per line. At least two required."
          required
        >
          <Textarea
            name="options"
            rows={5}
            required
            placeholder={"Option A\nOption B"}
          />
        </Field>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="allowMultiple" /> Allow multiple choices
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="anonymous" /> Anonymous responses
        </label>
        <Field label="Deadline (optional)">
          <Input type="datetime-local" name="deadlineAt" />
        </Field>
        <SubmitButton>Publish poll</SubmitButton>
      </ActionForm>
    </main>
  );
}
