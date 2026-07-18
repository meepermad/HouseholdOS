import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type MeetingTable = keyof Database["public"]["Tables"] &
  (
    | "household_meetings"
    | "household_meeting_participants"
    | "household_meeting_sections"
    | "household_meeting_agenda_items"
    | "household_meeting_packet_versions"
    | "household_meeting_snapshots"
    | "household_meeting_snapshot_values"
    | "household_meeting_session_notes"
    | "household_meeting_decisions"
    | "household_meeting_action_items"
    | "household_meeting_record_links"
    | "household_meeting_preferences"
  );

type MeetingRpc = keyof Database["public"]["Functions"] &
  (
    | "ensure_monthly_meeting"
    | "lock_meeting_packet"
    | "save_personal_meeting_addendum"
    | "start_meeting"
    | "complete_meeting"
    | "publish_meeting_recap"
    | "cancel_meeting"
    | "update_meeting_section"
    | "add_meeting_agenda_item"
    | "accept_suggested_agenda_item"
    | "dismiss_suggested_agenda_item"
    | "record_meeting_note"
    | "record_meeting_decision"
    | "create_meeting_action_item"
    | "mark_meeting_section_discussed"
    | "set_meeting_status_preparing"
    | "link_meeting_calendar_event"
  );

export async function meetingTable<T extends MeetingTable>(table: T) {
  const supabase = await createClient();
  return supabase.from(table);
}

/** RPC args accept nullish optional params the way form actions supply them. */
export async function meetingRpc<T extends MeetingRpc>(
  fn: T,
  args: Record<string, unknown>,
): Promise<{
  data: Database["public"]["Functions"][T]["Returns"] | null;
  error: { message: string } | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args as never);
  return {
    data: data as Database["public"]["Functions"][T]["Returns"] | null,
    error,
  };
}
