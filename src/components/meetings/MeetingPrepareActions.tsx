"use client";

import { useActionState } from "react";
import {
  completeMeetingAction,
  gatherMeetingPreviewAction,
  lockMeetingPacketAction,
  publishMeetingRecapAction,
  startMeetingAction,
} from "@/app/actions/meetings";
import type { ActionResult } from "@/app/actions/auth";

function ActionButton({
  action,
  householdId,
  meetingId,
  label,
  testId,
  primary,
}: {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  householdId: string;
  meetingId: string;
  label: string;
  testId: string;
  primary?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction}>
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="meetingId" value={meetingId} />
      <button
        type="submit"
        disabled={pending}
        data-testid={testId}
        className={
          primary
            ? "inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            : "inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium disabled:opacity-60"
        }
      >
        {pending ? "Working…" : label}
      </button>
      {state && !state.ok ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function MeetingPrepareActions({
  householdId,
  meetingId,
  status,
}: {
  householdId: string;
  meetingId: string;
  status: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="meeting-prepare-actions">
      {["draft", "preparing", "ready_for_review"].includes(status) ? (
        <ActionButton
          action={gatherMeetingPreviewAction}
          householdId={householdId}
          meetingId={meetingId}
          label="Gather source information"
          testId="gather-meeting-preview"
        />
      ) : null}
      {["draft", "preparing", "ready_for_review"].includes(status) ? (
        <ActionButton
          action={lockMeetingPacketAction}
          householdId={householdId}
          meetingId={meetingId}
          label="Lock packet"
          testId="lock-meeting-packet"
          primary
        />
      ) : null}
      {status === "locked" ? (
        <ActionButton
          action={startMeetingAction}
          householdId={householdId}
          meetingId={meetingId}
          label="Start meeting"
          testId="start-meeting"
          primary
        />
      ) : null}
      {status === "in_progress" ? (
        <ActionButton
          action={completeMeetingAction}
          householdId={householdId}
          meetingId={meetingId}
          label="Complete meeting"
          testId="complete-meeting"
          primary
        />
      ) : null}
      {status === "completed" || status === "published" ? (
        <ActionButton
          action={publishMeetingRecapAction}
          householdId={householdId}
          meetingId={meetingId}
          label="Publish recap"
          testId="publish-meeting-recap"
          primary
        />
      ) : null}
    </div>
  );
}
