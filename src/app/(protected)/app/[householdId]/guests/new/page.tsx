import { ActionForm } from "@/components/action-form";
import { createGuestNoticeAction } from "@/app/actions/coordination";
import { assertActiveMembership } from "@/lib/household-context";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

export default async function GuestNoticePage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="app-form-route space-y-4" data-testid="guest-notice-form">
      <h1 className="font-[family-name:var(--font-display)] text-2xl">
        Guest notice
      </h1>
      <p className="text-sm text-text-secondary">
        Let roommates know guests are coming. Guests do not need accounts.
      </p>
      <ActionForm
        action={createGuestNoticeAction}
        className="space-y-4"
        pendingLabel="Creating guest notice…"
      >
        <input type="hidden" name="householdId" value={householdId} />
        <Field label="Date">
          <Input type="date" name="visitDate" required defaultValue={today} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Start time">
            <Input type="time" name="startsAt" required defaultValue="18:00" />
          </Field>
          <Field label="End time">
            <Input type="time" name="endsAt" required defaultValue="22:00" />
          </Field>
        </div>
        <Field label="Approximate guest count">
          <Input
            type="number"
            name="guestCount"
            min={1}
            max={50}
            defaultValue={1}
            required
          />
        </Field>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="overnight" /> Overnight stay
        </label>
        <Field label="Shared spaces affected">
          <Input name="sharedSpaces" placeholder="Living room, kitchen…" />
        </Field>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="parkingNeeded" /> Parking needed
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="mealParticipation" /> Joining a shared meal
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="quietHoursException" /> Quiet-hours exception
          request
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="acknowledgmentRequested" /> Ask roommates to
          acknowledge
        </label>
        <Field label="Optional note">
          <Textarea name="note" rows={3} />
        </Field>
        <SubmitButton>Create guest notice</SubmitButton>
      </ActionForm>
    </main>
  );
}
