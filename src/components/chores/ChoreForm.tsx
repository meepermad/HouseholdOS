"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { createOneTimeChoreAction, createRecurringChoreAction } from "@/app/actions/chores";
import { CHORE_CATEGORIES, CHORE_CATEGORY_LABELS } from "@/lib/chores/categories";
import { buildRruleString } from "@/lib/calendar/recurrence";
import { calculateDueTimestamp } from "@/lib/chores/due";
import { MultiAssigneeSelector } from "./MultiAssigneeSelector";

export function ChoreForm({
  householdId,
  members,
  rotations = [],
  responsibilities = [],
  defaultTimeZone = "America/Chicago",
}: {
  householdId: string;
  members: Array<{ id: string; label: string }>;
  rotations?: Array<{ id: string; name: string }>;
  responsibilities?: Array<{ id: string; name: string }>;
  defaultTimeZone?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [recurring, setRecurring] = useState(false);
  const [allDay, setAllDay] = useState(false);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("18:00");
  const [timeZone, setTimeZone] = useState(defaultTimeZone);
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [assignees, setAssignees] = useState<string[]>([]);
  const dueAt = useMemo(() => {
    try {
      return calculateDueTimestamp({ dueDate: date, dueTime: allDay ? undefined : time, timeZone }).toISOString();
    } catch {
      return "";
    }
  }, [date, time, timeZone, allDay]);
  const rrule = useMemo(() => {
    if (!dueAt) return "";
    return buildRruleString({ frequency, interval: 1 }, new Date(dueAt), timeZone) ?? "";
  }, [frequency, dueAt, timeZone]);
  const dueTimeMinutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

  return (
    <ActionForm action={recurring ? createRecurringChoreAction : createOneTimeChoreAction} className="space-y-5" pendingLabel="Creating chore…">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="allDay" value={String(allDay)} />
      <input type="hidden" name="showOnCalendar" value="true" />
      <input type="hidden" name="dueAt" value={dueAt} />
      <input type="hidden" name="dueDate" value={allDay ? date : ""} />
      <input type="hidden" name="startDate" value={date} />
      <input type="hidden" name="dueTimeMinutes" value={allDay ? "" : dueTimeMinutes} />
      <input type="hidden" name="rrule" value={rrule} />
      <input type="hidden" name="assigneeMembershipIdsJson" value={JSON.stringify(assignees)} />
      <input type="hidden" name="reminderOffsetsJson" value="[1440,120]" />

      <Field label="Title"><Input name="title" required maxLength={200} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category">
          <Select name="category" defaultValue="other">
            {CHORE_CATEGORIES.map((category) => <option key={category} value={category}>{CHORE_CATEGORY_LABELS[category]}</option>)}
          </Select>
        </Field>
        <Field label="Visibility">
          <Select name="visibility" defaultValue="household">
            <option value="household">Whole household</option>
            <option value="assignees">Assignees only</option>
          </Select>
        </Field>
      </div>
      <Field label="Description"><Textarea name="description" rows={3} maxLength={4000} /></Field>
      <fieldset className="space-y-3 rounded-md border border-border bg-surface p-4">
        <legend className="px-1 text-sm font-semibold">Schedule</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
          Repeat this chore
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          All day
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={recurring ? "Starts" : "Due date"}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          {!allDay ? <Field label="Due time"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required /></Field> : null}
        </div>
        {recurring ? (
          <>
            <Field label="Repeats">
              <Select value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)}>
                <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
              </Select>
            </Field>
            <Field label="Rotation">
              <Select name="rotationId" defaultValue="">
                <option value="">No automatic rotation</option>
                {rotations.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </Field>
          </>
        ) : null}
        <Field label="Timezone"><Input name="timeZone" value={timeZone} onChange={(e) => setTimeZone(e.target.value)} /></Field>
      </fieldset>
      {!recurring ? (
        <fieldset className="space-y-2 rounded-md border border-border bg-surface p-4">
          <legend className="px-1 text-sm font-semibold">Assignees</legend>
          <MultiAssigneeSelector members={members} value={assignees} onChange={setAssignees} />
        </fieldset>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Responsibility area">
          <Select name="responsibilityAreaId" defaultValue="">
            <option value="">None</option>
            {responsibilities.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        <Field label="Grace period (minutes)"><Input name="gracePeriodMinutes" type="number" min={0} max={10080} defaultValue={120} /></Field>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="requiresVerification" /> Require completion verification
      </label>
      <Field label="Verifier">
        <Select name="verifierMembershipId" defaultValue="">
          <option value="">None</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </Select>
      </Field>
      <SubmitButton>Create chore</SubmitButton>
    </ActionForm>
  );
}
