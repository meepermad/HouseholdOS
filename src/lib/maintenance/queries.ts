import { createClient } from "@/lib/supabase/server";
import type {
  MaintenanceCategory,
  MaintenanceSeverity,
  MaintenanceStatus,
} from "./types";

export type MaintenanceListItem = {
  id: string;
  title: string;
  category: MaintenanceCategory;
  severity: MaintenanceSeverity;
  status: MaintenanceStatus;
  created_at: string;
  location_id: string | null;
  primary_coordinator_membership_id: string | null;
};

export async function listMaintenanceRequests(
  householdId: string,
): Promise<MaintenanceListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("maintenance_requests")
    .select(
      "id, title, category, severity, status, created_at, location_id, primary_coordinator_membership_id",
    )
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as MaintenanceListItem[];
}

export async function getMaintenanceRequest(
  householdId: string,
  requestId: string,
) {
  const supabase = await createClient();
  const { data: request } = await supabase
    .from("maintenance_requests")
    .select("*")
    .eq("household_id", householdId)
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return null;

  const [{ data: events }, { data: attachments }, { data: assignments }] =
    await Promise.all([
      supabase
        .from("maintenance_events")
        .select("id, event_type, body, payload, created_at, actor_membership_id")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true }),
      supabase
        .from("maintenance_attachments")
        .select("id, file_name, mime_type, size_bytes, created_at")
        .eq("request_id", requestId)
        .is("deleted_at", null),
      supabase
        .from("maintenance_assignments")
        .select("membership_id, is_primary, assigned_at")
        .eq("request_id", requestId)
        .is("unassigned_at", null),
    ]);

  return {
    request,
    events: events ?? [],
    attachments: attachments ?? [],
    assignments: assignments ?? [],
  };
}

export async function listMaintenanceVendors(householdId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("maintenance_external_contacts")
    .select("*")
    .eq("household_id", householdId)
    .eq("active", true)
    .order("display_name");
  return data ?? [];
}
