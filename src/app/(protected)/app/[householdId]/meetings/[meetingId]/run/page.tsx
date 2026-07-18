import { notFound } from "next/navigation";
import { assertActiveMembership } from "@/lib/household-context";
import { AppBackButton } from "@/components/app-back-button";
import { householdRoutes } from "@/lib/routes/household";
import { MeetingModeClient } from "@/components/meetings/MeetingModeClient";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import { meetingTable } from "@/lib/meetings/client";

export const dynamic = "force-dynamic";

export default async function MeetingRunPage({
  params,
}: {
  params: Promise<{ householdId: string; meetingId: string }>;
}) {
  const { householdId, meetingId } = await params;
  await assertActiveMembership(householdId);

  const meetingsT = await meetingTable("household_meetings");
  const { data: meeting } = await meetingsT
    .select("id, title, status, period_start, period_end")
    .eq("id", meetingId)
    .eq("household_id", householdId)
    .maybeSingle();
  if (!meeting) notFound();
  if (!["locked", "in_progress", "completed"].includes(String(meeting.status))) {
    notFound();
  }

  const sectionsT = await meetingTable("household_meeting_sections");
  const notesT = await meetingTable("household_meeting_session_notes");
  const decisionsT = await meetingTable("household_meeting_decisions");

  const [{ data: sections }, { data: notes }, { data: decisions }, members] =
    await Promise.all([
      sectionsT
        .select("*")
        .eq("meeting_id", meetingId)
        .eq("included", true)
        .order("sort_order"),
      notesT
        .select("id, body, section_key, parking_lot, created_at")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: false })
        .limit(40),
      decisionsT
        .select("id, decision_text, created_at")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: false })
        .limit(40),
      listActiveMemberOptions(householdId),
    ]);

  const sectionRows = (sections ?? []) as Array<{
    section_key: string;
    title: string;
    discussed_at: string | null;
    skipped_at: string | null;
    organizer_note: string | null;
  }>;
  const noteRows = (notes ?? []) as Array<{
    id: string;
    body: string;
    section_key: string | null;
    parking_lot: boolean;
  }>;
  const decisionRows = (decisions ?? []) as Array<{
    id: string;
    decision_text: string;
  }>;

  return (
    <main className="space-y-4" data-testid="meeting-mode">
      <AppBackButton
        fallbackHref={householdRoutes.meetings.detail(householdId, meetingId)}
      />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Meeting mode
        </h1>
        <p className="text-sm text-text-secondary">{String(meeting.title)}</p>
      </header>
      <MeetingModeClient
        householdId={householdId}
        meetingId={meetingId}
        sections={sectionRows.map((s) => ({
          key: s.section_key,
          title: s.title,
          discussedAt: s.discussed_at,
          skippedAt: s.skipped_at,
          note: s.organizer_note,
        }))}
        notes={noteRows.map((n) => ({
          id: n.id,
          body: n.body,
          sectionKey: n.section_key,
          parkingLot: n.parking_lot,
        }))}
        decisions={decisionRows.map((d) => ({
          id: d.id,
          text: d.decision_text,
        }))}
        members={members}
      />
    </main>
  );
}
