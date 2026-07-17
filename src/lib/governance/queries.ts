import { createClient } from "@/lib/supabase/server";
import type {
  GovernanceDocumentClass,
  GovernanceStatus,
  GovernanceVisibility,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;

export type GovernanceDocumentListItem = {
  id: string;
  title: string;
  summary: string | null;
  status: GovernanceStatus;
  document_class: GovernanceDocumentClass;
  visibility: GovernanceVisibility;
  is_financial: boolean;
  updated_at: string;
  current_version_id: string | null;
  active_version_id: string | null;
};

export type GovernanceTemplateRow = {
  id: string;
  template_key: string;
  title: string;
  summary: string | null;
  document_class: GovernanceDocumentClass;
  is_system: boolean;
};

export type TransitionListItem = {
  id: string;
  workflow_type: "move_in" | "move_out";
  status: string;
  planned_date: string | null;
  subject_membership_id: string;
  updated_at: string;
};

export async function listGovernanceDocuments(
  householdId: string,
  filter?: { status?: GovernanceStatus | GovernanceStatus[] },
): Promise<GovernanceDocumentListItem[]> {
  const supabase = (await createClient()) as UntypedDb;
  let q = supabase
    .from("governance_documents")
    .select(
      "id, title, summary, status, document_class, visibility, is_financial, updated_at, current_version_id, active_version_id",
    )
    .eq("household_id", householdId)
    .order("updated_at", { ascending: false });
  if (filter?.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    q = q.in("status", statuses);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as GovernanceDocumentListItem[];
}

export async function getGovernanceDocument(documentId: string) {
  const supabase = (await createClient()) as UntypedDb;
  const { data: doc, error } = await supabase
    .from("governance_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw error;
  if (!doc) return null;

  const { data: version } = await supabase
    .from("governance_document_versions")
    .select("*")
    .eq("id", doc.current_version_id)
    .maybeSingle();

  const { data: sections } = await supabase
    .from("governance_sections")
    .select("*")
    .eq("version_id", doc.current_version_id)
    .order("position");

  const { data: events } = await supabase
    .from("governance_events")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: approvalRequest } = await supabase
    .from("governance_approval_requests")
    .select("*")
    .eq("document_id", documentId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let approvalStatus = null;
  if (approvalRequest?.id) {
    const { data } = await supabase.rpc("governance_approval_status", {
      p_request_id: approvalRequest.id,
    });
    approvalStatus = data;
  }

  const { data: responses } = approvalRequest?.id
    ? await supabase
        .from("governance_approval_responses")
        .select("*")
        .eq("request_id", approvalRequest.id)
    : { data: [] };

  return {
    document: doc,
    version,
    sections: sections ?? [],
    events: events ?? [],
    approvalRequest,
    approvalStatus,
    responses: responses ?? [],
  };
}

export async function listGovernanceTemplates(): Promise<GovernanceTemplateRow[]> {
  const supabase = (await createClient()) as UntypedDb;
  const { data, error } = await supabase
    .from("governance_templates")
    .select("id, template_key, title, summary, document_class, is_system")
    .eq("active", true)
    .order("title");
  if (error) throw error;
  return (data ?? []) as GovernanceTemplateRow[];
}

export async function listPendingAcknowledgments(householdId: string, membershipId: string) {
  const supabase = (await createClient()) as UntypedDb;
  const { data, error } = await supabase
    .from("governance_acknowledgments")
    .select("*, governance_documents(id, title), governance_document_versions(id, version_number, title)")
    .eq("household_id", householdId)
    .eq("membership_id", membershipId)
    .in("status", ["pending", "overdue"])
    .order("due_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function listOpenApprovalRequests(householdId: string) {
  const supabase = (await createClient()) as UntypedDb;
  const { data, error } = await supabase
    .from("governance_approval_requests")
    .select("*, governance_documents(id, title, status)")
    .eq("household_id", householdId)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listTransitions(
  householdId: string,
): Promise<TransitionListItem[]> {
  const supabase = (await createClient()) as UntypedDb;
  const { data, error } = await supabase
    .from("household_transition_workflows")
    .select(
      "id, workflow_type, status, planned_date, subject_membership_id, updated_at",
    )
    .eq("household_id", householdId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TransitionListItem[];
}

export async function getTransitionWorkflow(workflowId: string) {
  const supabase = (await createClient()) as UntypedDb;
  const { data: workflow, error } = await supabase
    .from("household_transition_workflows")
    .select("*")
    .eq("id", workflowId)
    .maybeSingle();
  if (error) throw error;
  if (!workflow) return null;

  const { data: tasks } = await supabase
    .from("household_transition_tasks")
    .select("*")
    .eq("workflow_id", workflowId)
    .order("position");

  const { data: events } = await supabase
    .from("household_transition_events")
    .select("*")
    .eq("workflow_id", workflowId)
    .order("created_at", { ascending: false })
    .limit(40);

  return { workflow, tasks: tasks ?? [], events: events ?? [] };
}

export async function listDocumentVersions(documentId: string) {
  const supabase = (await createClient()) as UntypedDb;
  const { data, error } = await supabase
    .from("governance_document_versions")
    .select("*")
    .eq("document_id", documentId)
    .order("version_number", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getVersionWithSections(versionId: string) {
  const supabase = (await createClient()) as UntypedDb;
  const { data: version, error } = await supabase
    .from("governance_document_versions")
    .select("*")
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw error;
  if (!version) return null;
  const { data: sections } = await supabase
    .from("governance_sections")
    .select("*")
    .eq("version_id", versionId)
    .order("position");
  return { version, sections: sections ?? [] };
}
