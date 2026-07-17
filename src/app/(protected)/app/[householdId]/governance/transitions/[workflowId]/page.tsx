import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import {
  advanceTransitionAction,
  completeTransitionAction,
  completeTransitionTaskAction,
} from "@/app/actions/governance";
import { getTransitionWorkflow } from "@/lib/governance/queries";

export default async function TransitionDetailPage({
  params,
}: {
  params: Promise<{ householdId: string; workflowId: string }>;
}) {
  const { householdId, workflowId } = await params;
  const detail = await getTransitionWorkflow(workflowId);
  if (!detail?.workflow || detail.workflow.household_id !== householdId) {
    notFound();
  }
  const { workflow, tasks, events } = detail;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 pb-24">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold capitalize">
          {workflow.workflow_type.replace("_", "-")} workflow
        </h1>
        <p className="text-sm text-text-secondary">
          Status: {workflow.status}
          {workflow.planned_date ? ` · Planned ${workflow.planned_date}` : ""}
        </p>
        <p className="text-xs text-text-secondary">
          Completing this workflow does not automatically remove membership or
          declare debts, deposits, or damage responsibility.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {workflow.status === "draft" ? (
          <ActionForm action={advanceTransitionAction}>
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="workflowId" value={workflowId} />
            <input type="hidden" name="nextStatus" value="in_progress" />
            <button
              type="submit"
              className="min-h-11 rounded-md border border-border px-3 text-sm"
            >
              Start
            </button>
          </ActionForm>
        ) : null}
        {["in_progress", "ready_to_complete"].includes(workflow.status) ? (
          <ActionForm action={completeTransitionAction} className="space-y-2">
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="workflowId" value={workflowId} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="scheduleMembershipRemoval" value="true" />
              Schedule membership removal discussion (does not remove now)
            </label>
            <button
              type="submit"
              className="min-h-11 rounded-md bg-primary px-4 text-sm text-primary-foreground"
            >
              Mark complete
            </button>
          </ActionForm>
        ) : null}
        {!["completed", "cancelled"].includes(workflow.status) ? (
          <ActionForm action={advanceTransitionAction}>
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="workflowId" value={workflowId} />
            <input type="hidden" name="nextStatus" value="cancelled" />
            <button
              type="submit"
              className="min-h-11 rounded-md border border-border px-3 text-sm"
            >
              Cancel
            </button>
          </ActionForm>
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Checklist</h2>
        <ul className="space-y-3">
          {tasks.map(
            (task: {
              id: string;
              title: string;
              status: string;
              description: string | null;
              requires_explicit_confirmation: boolean;
            }) => (
              <li
                key={task.id}
                className="space-y-2 rounded-md border border-border p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{task.title}</p>
                  <span className="text-xs text-text-secondary">{task.status}</span>
                </div>
                {task.description ? (
                  <p className="text-sm text-text-secondary">{task.description}</p>
                ) : null}
                {task.status !== "done" && task.status !== "cancelled" ? (
                  <ActionForm
                    action={completeTransitionTaskAction}
                    className="space-y-2"
                  >
                    <input type="hidden" name="householdId" value={householdId} />
                    <input type="hidden" name="taskId" value={task.id} />
                    {task.requires_explicit_confirmation ? (
                      <textarea
                        name="note"
                        required
                        className="min-h-16 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                        placeholder="Explicit confirmation note required"
                      />
                    ) : (
                      <input type="hidden" name="note" value="" />
                    )}
                    <button
                      type="submit"
                      className="min-h-11 rounded-md border border-border px-3 text-sm"
                    >
                      Mark done
                    </button>
                  </ActionForm>
                ) : null}
              </li>
            ),
          )}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Timeline</h2>
        <ol className="space-y-2 border-l border-border pl-4">
          {events.map(
            (e: {
              id: string;
              event_type: string;
              body: string | null;
              created_at: string;
            }) => (
              <li key={e.id} className="text-sm">
                <p className="font-medium">{e.event_type.replaceAll("_", " ")}</p>
                {e.body ? <p className="text-text-secondary">{e.body}</p> : null}
                <p className="text-xs text-text-secondary">
                  {new Date(e.created_at).toLocaleString()}
                </p>
              </li>
            ),
          )}
        </ol>
      </section>
    </div>
  );
}
