import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import {
  addMaintenanceCommentAction,
  claimMaintenanceAction,
  reopenMaintenanceAction,
  resolveMaintenanceAction,
  scheduleMaintenanceAppointmentAction,
} from "@/app/actions/maintenance";
import { getMaintenanceRequest } from "@/lib/maintenance/queries";
import {
  EMERGENCY_DISCLAIMER,
  maintenanceCategoryLabel,
  maintenanceSeverityLabel,
  maintenanceSeverityMark,
  maintenanceStatusLabel,
  safetyGuidanceForHazards,
  type MaintenanceCategory,
  type MaintenanceSeverity,
  type MaintenanceStatus,
  type SafetyHazardFlag,
} from "@/lib/maintenance";
import { notFound } from "next/navigation";

export default async function MaintenanceDetailPage({
  params,
}: {
  params: Promise<{ householdId: string; requestId: string }>;
}) {
  const { householdId, requestId } = await params;
  const detail = await getMaintenanceRequest(householdId, requestId);
  if (!detail) notFound();
  const { request, events, attachments, assignments } = detail;
  const hazards = (request.hazard_flags ?? []) as SafetyHazardFlag[];
  const guidance = safetyGuidanceForHazards(hazards);
  const severity = request.severity as MaintenanceSeverity;
  const category = request.category as MaintenanceCategory;
  const status = request.status as MaintenanceStatus;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <header className="space-y-2">
        <Link
          href={`/app/${householdId}/maintenance`}
          className="text-sm text-text-secondary"
        >
          ← Maintenance
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">{request.title}</h1>
          <span
            className="rounded border border-border px-2 py-1 text-xs font-medium"
            aria-label={`Severity ${maintenanceSeverityLabel(severity)}`}
          >
            <span aria-hidden="true" className="mr-1">
              {maintenanceSeverityMark(severity)}
            </span>
            {maintenanceSeverityLabel(severity)}
          </span>
        </div>
        <p className="text-sm text-text-secondary">
          {maintenanceCategoryLabel(category)} ·{" "}
          {maintenanceStatusLabel(status)}
        </p>
      </header>

      {guidance.length > 0 || severity === "emergency_guidance" ? (
        <aside role="alert" className="rounded-md border-2 border-border p-4 space-y-2">
          <p className="text-sm font-semibold">{EMERGENCY_DISCLAIMER}</p>
          {guidance.map((g) => (
            <div key={g.hazard}>
              <h2 className="font-medium">{g.title}</h2>
              <ul className="list-disc pl-5 text-sm text-text-secondary">
                {g.guidance.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </aside>
      ) : null}

      {request.description ? (
        <p className="text-sm whitespace-pre-wrap">{request.description}</p>
      ) : null}
      {request.immediate_mitigation ? (
        <p className="text-sm">
          <span className="font-medium">Mitigation: </span>
          {request.immediate_mitigation}
        </p>
      ) : null}

      <section className="sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap gap-2 rounded-md border border-border bg-surface p-3 md:static">
        {request.status !== "resolved" &&
        request.status !== "closed" &&
        request.status !== "cancelled" ? (
          <>
            <ActionForm action={claimMaintenanceAction}>
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="requestId" value={requestId} />
              <button
                type="submit"
                className="min-h-11 rounded-md border border-border px-3 text-sm"
              >
                Claim follow-up
              </button>
            </ActionForm>
            <ActionForm action={resolveMaintenanceAction}>
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="requestId" value={requestId} />
              <input type="hidden" name="decisionOutcome" value="repair" />
              <button
                type="submit"
                className="min-h-11 rounded-md bg-primary px-3 text-sm text-primary-foreground"
              >
                Mark resolved
              </button>
            </ActionForm>
          </>
        ) : (
          <ActionForm action={reopenMaintenanceAction}>
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="requestId" value={requestId} />
            <button
              type="submit"
              className="min-h-11 rounded-md border border-border px-3 text-sm"
            >
              Reopen
            </button>
          </ActionForm>
        )}
        <Link
          href={`/app/${householdId}/maintenance/${requestId}/evidence`}
          className="min-h-11 rounded-md border border-border px-3 py-2.5 text-sm"
        >
          Evidence
        </Link>
        <Link
          href={`/app/${householdId}/maintenance/${requestId}/appointments`}
          className="min-h-11 rounded-md border border-border px-3 py-2.5 text-sm"
        >
          Appointments
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Timeline</h2>
        <ol className="space-y-3 border-l border-border pl-4">
          {events.map((e) => (
            <li key={e.id} className="text-sm">
              <p className="font-medium">{e.event_type.replaceAll("_", " ")}</p>
              {e.body ? (
                <p className="text-text-secondary whitespace-pre-wrap">{e.body}</p>
              ) : null}
              <p className="text-xs text-text-secondary">
                {new Date(e.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Add update</h2>
        <ActionForm action={addMaintenanceCommentAction} className="space-y-3">
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="requestId" value={requestId} />
          <textarea
            name="body"
            required
            rows={3}
            className="w-full rounded-md border border-border bg-surface px-3 py-2"
            placeholder="What changed?"
          />
          <button
            type="submit"
            className="min-h-11 rounded-md bg-primary px-4 text-sm text-primary-foreground"
          >
            Add comment
          </button>
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Schedule appointment</h2>
        <ActionForm
          action={scheduleMaintenanceAppointmentAction}
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="requestId" value={requestId} />
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-sm font-medium">Title</span>
            <input
              name="title"
              required
              defaultValue={`Maintenance: ${request.title}`}
              className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Starts</span>
            <input
              name="startsAt"
              type="datetime-local"
              required
              className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Ends</span>
            <input
              name="endsAt"
              type="datetime-local"
              required
              className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
            />
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-md border border-border px-4 text-sm sm:col-span-2"
          >
            Add to calendar
          </button>
        </ActionForm>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Assignees</h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-text-secondary">Unassigned</p>
        ) : (
          <ul className="text-sm">
            {assignments.map((a) => (
              <li key={a.membership_id}>
                {a.membership_id.slice(0, 8)}
                {a.is_primary ? " (primary)" : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Evidence</h2>
        {attachments.length === 0 ? (
          <p className="text-sm text-text-secondary">No evidence attached</p>
        ) : (
          <ul className="text-sm">
            {attachments.map((a) => (
              <li key={a.id}>
                {a.file_name} · {a.mime_type}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
