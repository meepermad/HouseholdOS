import { ActionForm } from "@/components/action-form";
import {
  archiveHouseholdAction,
  leaveHouseholdAction,
  updateHouseholdAction,
  updateSettingsAction,
} from "@/app/actions/household";
import { assertActiveMembership } from "@/lib/household-context";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HouseholdSettingsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const supabase = await createClient();
  const [{ data: household }, { data: settings }] = await Promise.all([
    supabase.from("households").select("*").eq("id", householdId).single(),
    supabase.from("household_settings").select("*").eq("household_id", householdId).single(),
  ]);

  return (
    <main className="space-y-8">
      <h1 className="text-2xl font-semibold">Household settings</h1>

      {can(ctx.roles, "household.update") ? (
        <ActionForm action={updateHouseholdAction} className="space-y-3">
          <input type="hidden" name="householdId" value={householdId} />
          <label className="block text-sm">
            Name
            <input
              name="name"
              required
              defaultValue={household?.name ?? ""}
              className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Property nickname
            <input
              name="propertyNickname"
              defaultValue={household?.property_nickname ?? ""}
              className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Lease start
              <input
                name="leaseStart"
                type="date"
                defaultValue={household?.lease_start ?? ""}
                className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Lease end
              <input
                name="leaseEnd"
                type="date"
                defaultValue={household?.lease_end ?? ""}
                className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
              />
            </label>
          </div>
          <label className="block text-sm">
            Timezone
            <input
              name="timezone"
              required
              defaultValue={household?.timezone ?? "America/Chicago"}
              className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Currency
            <input
              name="currency"
              required
              defaultValue={household?.currency ?? "USD"}
              className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Save household
          </button>
        </ActionForm>
      ) : null}

      {can(ctx.roles, "settings.update") ? (
        <ActionForm action={updateSettingsAction} className="space-y-3">
          <h2 className="font-semibold">Approvals & reimbursement</h2>
          <p className="text-sm text-slate-600">
            Policy: one roommate pays; shared portions create reimbursement obligations;
            payment is confirmed outside HouseholdOS.
          </p>
          <input type="hidden" name="householdId" value={householdId} />
          <label className="block text-sm">
            Purchase approval threshold (cents)
            <input
              name="purchaseApprovalThresholdCents"
              type="number"
              min={0}
              defaultValue={settings?.purchase_approval_threshold_cents ?? 5000}
              className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Approval rule
            <select
              name="approvalRule"
              defaultValue={settings?.approval_rule ?? "threshold"}
              className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
            >
              <option value="threshold">Threshold</option>
              <option value="always">Always</option>
              <option value="never">Never</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Save settings
          </button>
        </ActionForm>
      ) : null}

      <ActionForm action={leaveHouseholdAction}>
        <input type="hidden" name="householdId" value={householdId} />
        <button type="submit" className="text-sm text-red-700 underline">
          Leave household
        </button>
      </ActionForm>

      {can(ctx.roles, "household.archive") ? (
        <ActionForm action={archiveHouseholdAction}>
          <input type="hidden" name="householdId" value={householdId} />
          <button type="submit" className="text-sm text-red-700 underline">
            Archive household
          </button>
        </ActionForm>
      ) : null}
    </main>
  );
}
