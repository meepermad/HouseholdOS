"use client";

import { useActionState, useState } from "react";
import {
  createMeetingActionItemAction,
  markSectionDiscussedAction,
  recordMeetingDecisionAction,
  recordMeetingNoteAction,
} from "@/app/actions/meetings";

type Section = {
  key: string;
  title: string;
  discussedAt: string | null;
  skippedAt: string | null;
  note: string | null;
};

export function MeetingModeClient({
  householdId,
  meetingId,
  sections,
  notes,
  decisions,
  members,
}: {
  householdId: string;
  meetingId: string;
  sections: Section[];
  notes: { id: string; body: string; sectionKey: string | null; parkingLot: boolean }[];
  decisions: { id: string; text: string }[];
  members: { id: string; label: string }[];
}) {
  const [index, setIndex] = useState(0);
  const section = sections[index] ?? null;
  const progress = sections.length
    ? Math.round(
        ((sections.filter((s) => s.discussedAt || s.skippedAt).length) /
          sections.length) *
          100,
      )
    : 0;

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)_16rem] lg:gap-6 lg:space-y-0">
      <aside className="hidden lg:block">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Agenda
        </p>
        <ol className="space-y-1 text-sm">
          {sections.map((s, i) => (
            <li key={s.key}>
              <button
                type="button"
                className={`w-full rounded-md px-2 py-2 text-left min-h-11 ${
                  i === index ? "bg-surface-interactive font-medium" : ""
                }`}
                onClick={() => setIndex(i)}
              >
                {s.title}
                {s.discussedAt || s.skippedAt ? " ✓" : ""}
              </button>
            </li>
          ))}
        </ol>
      </aside>

      <div className="space-y-4">
        <div
          className="sticky top-0 z-10 space-y-2 border-b border-border bg-background py-2"
          data-testid="meeting-progress"
        >
          <div className="flex h-2 overflow-hidden rounded-sm bg-border/60">
            <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-text-muted">
            {progress}% discussed · Section {index + 1} of {sections.length}
          </p>
        </div>

        {section ? (
          <section className="space-y-3" data-testid="meeting-section">
            <h2 className="text-xl font-semibold">{section.title}</h2>
            {section.note ? (
              <p className="text-sm text-text-secondary">{section.note}</p>
            ) : (
              <p className="text-sm text-text-muted">
                Review this section, add notes, and record outcomes.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <MarkForm
                householdId={householdId}
                meetingId={meetingId}
                sectionKey={section.key}
                skipped={false}
                label="Mark discussed"
              />
              <MarkForm
                householdId={householdId}
                meetingId={meetingId}
                sectionKey={section.key}
                skipped
                label="Skip for later"
              />
              <button
                type="button"
                className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm"
                disabled={index <= 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm"
                disabled={index >= sections.length - 1}
                onClick={() => setIndex((i) => Math.min(sections.length - 1, i + 1))}
              >
                Next
              </button>
            </div>

            <NoteForm
              householdId={householdId}
              meetingId={meetingId}
              sectionKey={section.key}
            />
          </section>
        ) : null}
      </div>

      <aside className="space-y-4">
        <DecisionForm householdId={householdId} meetingId={meetingId} />
        <ActionItemForm
          householdId={householdId}
          meetingId={meetingId}
          members={members}
        />
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Decisions
          </h3>
          <ul className="mt-2 space-y-2 text-sm">
            {decisions.map((d) => (
              <li key={d.id} className="rounded-md border border-border px-3 py-2">
                {d.text}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Notes
          </h3>
          <ul className="mt-2 space-y-2 text-sm">
            {notes.map((n) => (
              <li key={n.id} className="rounded-md border border-border px-3 py-2">
                {n.parkingLot ? (
                  <span className="mr-1 text-xs text-text-muted">Parking lot · </span>
                ) : null}
                {n.body}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function MarkForm(props: {
  householdId: string;
  meetingId: string;
  sectionKey: string;
  skipped: boolean;
  label: string;
}) {
  const [, action, pending] = useActionState(markSectionDiscussedAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="householdId" value={props.householdId} />
      <input type="hidden" name="meetingId" value={props.meetingId} />
      <input type="hidden" name="sectionKey" value={props.sectionKey} />
      <input type="hidden" name="skipped" value={props.skipped ? "true" : "false"} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm"
      >
        {props.label}
      </button>
    </form>
  );
}

function NoteForm(props: {
  householdId: string;
  meetingId: string;
  sectionKey: string;
}) {
  const [state, action, pending] = useActionState(recordMeetingNoteAction, null);
  return (
    <form action={action} className="space-y-2 rounded-md border border-border p-3">
      <input type="hidden" name="householdId" value={props.householdId} />
      <input type="hidden" name="meetingId" value={props.meetingId} />
      <input type="hidden" name="sectionKey" value={props.sectionKey} />
      <label className="block text-sm">
        Add note
        <textarea
          name="body"
          required
          rows={3}
          className="mt-1 w-full rounded-md border border-border bg-input-bg px-2 py-2"
        />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="parkingLot" />
        Add to parking lot
      </label>
      {state && !state.ok ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md bg-secondary px-3 text-sm font-medium"
      >
        Save note
      </button>
    </form>
  );
}

function DecisionForm(props: { householdId: string; meetingId: string }) {
  const [idem] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState(recordMeetingDecisionAction, null);
  return (
    <form action={action} className="space-y-2 rounded-md border border-border p-3">
      <input type="hidden" name="householdId" value={props.householdId} />
      <input type="hidden" name="meetingId" value={props.meetingId} />
      <input type="hidden" name="idempotencyKey" value={idem} />
      <label className="block text-sm font-medium">
        Record outcome
        <textarea
          name="decisionText"
          required
          rows={2}
          className="mt-1 w-full rounded-md border border-border bg-input-bg px-2 py-2 text-sm font-normal"
        />
      </label>
      {state && !state.ok ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
      >
        Save decision
      </button>
    </form>
  );
}

function ActionItemForm(props: {
  householdId: string;
  meetingId: string;
  members: { id: string; label: string }[];
}) {
  const [idem] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState(createMeetingActionItemAction, null);
  return (
    <form action={action} className="space-y-2 rounded-md border border-border p-3">
      <input type="hidden" name="householdId" value={props.householdId} />
      <input type="hidden" name="meetingId" value={props.meetingId} />
      <input type="hidden" name="idempotencyKey" value={idem} />
      <label className="block text-sm font-medium">
        Action item
        <input
          name="title"
          required
          className="mt-1 w-full rounded-md border border-border bg-input-bg px-2 py-2 text-sm font-normal"
        />
      </label>
      <label className="block text-sm">
        Owner
        <select
          name="ownerMembershipId"
          className="mt-1 w-full min-h-11 rounded-md border border-border bg-input-bg px-2"
        >
          <option value="">Unassigned</option>
          {props.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Due date
        <input
          type="date"
          name="dueDate"
          className="mt-1 w-full min-h-11 rounded-md border border-border bg-input-bg px-2"
        />
      </label>
      {state && !state.ok ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-medium"
      >
        Create action item
      </button>
    </form>
  );
}
