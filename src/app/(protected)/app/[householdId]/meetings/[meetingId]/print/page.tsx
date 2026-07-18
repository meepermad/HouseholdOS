import { notFound } from "next/navigation";
import { assertActiveMembership } from "@/lib/household-context";
import { meetingTable } from "@/lib/meetings/client";
import { buildPersonalMeetingAddendum } from "@/lib/meetings/packet";

export const dynamic = "force-dynamic";

export default async function MeetingPrintPage({
  params,
}: {
  params: Promise<{ householdId: string; meetingId: string }>;
}) {
  const { householdId, meetingId } = await params;
  const ctx = await assertActiveMembership(householdId);

  const meetingsT = await meetingTable("household_meetings");
  const { data: meeting } = await meetingsT
    .select("*")
    .eq("id", meetingId)
    .eq("household_id", householdId)
    .maybeSingle();
  if (!meeting) notFound();

  const snapshotsT = await meetingTable("household_meeting_snapshots");
  const decisionsT = await meetingTable("household_meeting_decisions");
  const actionsT = await meetingTable("household_meeting_action_items");

  const [{ data: sharedSnap }, { data: decisions }, { data: actions }, personal] =
    await Promise.all([
      snapshotsT
        .select("payload, created_at")
        .eq("meeting_id", meetingId)
        .eq("projection", "shared")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      decisionsT
        .select("decision_text, created_at")
        .eq("meeting_id", meetingId)
        .order("created_at"),
      actionsT
        .select("title, due_date, status, owner_membership_id")
        .eq("meeting_id", meetingId)
        .order("created_at"),
      buildPersonalMeetingAddendum({
        householdId,
        membershipId: ctx.membershipId,
      }),
    ]);

  const decisionRows = (decisions ?? []) as Array<{ decision_text: string }>;
  const actionRows = (actions ?? []) as Array<{
    title: string;
    due_date: string | null;
    status: string;
  }>;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 print:p-0" data-testid="meeting-print">
      <header className="space-y-2 border-b border-border pb-4">
        <h1 className="text-2xl font-semibold">{String(meeting.title)}</h1>
        <p className="text-sm text-text-secondary">
          Household financial summary and meeting recap · {String(meeting.period_start)} –{" "}
          {String(meeting.period_end)}
        </p>
        <p className="text-xs text-text-muted">
          Shared packet only below. Personal addendum is printed separately for the current
          member.
        </p>
      </header>

      <section>
        <h2 className="text-lg font-semibold">Decisions</h2>
        {decisionRows.length === 0 ? (
          <p className="text-sm text-text-muted">No decisions recorded.</p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {decisionRows.map((d, i) => (
              <li key={i}>{d.decision_text}</li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Action items</h2>
        {actionRows.length === 0 ? (
          <p className="text-sm text-text-muted">No action items.</p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {actionRows.map((a, i) => (
              <li key={i}>
                {a.title}
                {a.due_date ? ` · due ${a.due_date}` : ""} · {a.status}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-md border border-dashed border-border p-4">
        <h2 className="text-lg font-semibold">Personal addendum (private)</h2>
        <p className="mt-2 text-sm">
          You owe ${(personal.youOweCents / 100).toFixed(2)} · You are owed $
          {(personal.youAreOwedCents / 100).toFixed(2)}
        </p>
        <p className="text-sm text-text-secondary">
          {personal.pendingConfirmations} payment confirmation
          {personal.pendingConfirmations === 1 ? "" : "s"} · {personal.receiptDrafts}{" "}
          receipt draft{personal.receiptDrafts === 1 ? "" : "s"}
        </p>
      </section>

      {sharedSnap?.payload ? (
        <section className="text-xs text-text-muted">
          Snapshot captured {String(sharedSnap.created_at)}
        </section>
      ) : null}
    </main>
  );
}
