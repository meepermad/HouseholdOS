import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { createTransitionAction } from "@/app/actions/governance";
import { listTransitions } from "@/lib/governance/queries";
import { createClient } from "@/lib/supabase/server";

export default async function GovernanceTransitionsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const transitions = await listTransitions(householdId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { data: members } = await supabase
    .from("household_memberships")
    .select("id, status, profiles(display_name, email)")
    .eq("household_id", householdId)
    .eq("status", "active");

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6">
      <h1 className="text-2xl font-semibold">Household transitions</h1>
      <p className="text-sm text-text-secondary">
        Move-in and move-out checklists organize household coordination. Creating a
        workflow does not remove membership or create financial obligations.
      </p>

      <section className="space-y-3 rounded-md border border-border p-4">
        <h2 className="text-lg font-semibold">Start a workflow</h2>
        <ActionForm action={createTransitionAction} className="space-y-3">
          <input type="hidden" name="householdId" value={householdId} />
          <label className="block space-y-1 text-sm">
            <span>Type</span>
            <select
              name="workflowType"
              className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
              defaultValue="move_in"
            >
              <option value="move_in">Move-in</option>
              <option value="move_out">Move-out</option>
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span>Member</span>
            <select
              name="subjectMembershipId"
              required
              className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
              defaultValue=""
            >
              <option value="" disabled>
                Select member
              </option>
              {(members ?? []).map(
                (m: {
                  id: string;
                  profiles:
                    | { display_name: string | null; email: string | null }
                    | { display_name: string | null; email: string | null }[]
                    | null;
                }) => {
                  const profile = Array.isArray(m.profiles)
                    ? m.profiles[0]
                    : m.profiles;
                  return (
                    <option key={m.id} value={m.id}>
                      {profile?.display_name ??
                        profile?.email ??
                        m.id.slice(0, 8)}
                    </option>
                  );
                },
              )}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span>Planned date</span>
            <input
              type="date"
              name="plannedDate"
              className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
            />
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-md bg-primary px-4 text-sm text-primary-foreground"
          >
            Create workflow
          </button>
        </ActionForm>
      </section>

      <ul className="space-y-2">
        {transitions.map((t) => (
          <li key={t.id}>
            <Link
              href={`/app/${householdId}/governance/transitions/${t.id}`}
              className="flex items-center justify-between rounded-md border border-border px-3 py-3"
            >
              <span className="font-medium capitalize">
                {t.workflow_type.replace("_", "-")}
              </span>
              <span className="text-sm text-text-secondary">{t.status}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
