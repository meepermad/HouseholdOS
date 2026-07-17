import { createClient } from "@/lib/supabase/server";

const MAINTENANCE_EVIDENCE_BUCKET = "maintenance-evidence";
const GOVERNANCE_ATTACHMENTS_BUCKET = "governance-attachments";
const CALENDAR_ATTACHMENTS_BUCKET = "calendar-attachments";
const EXPENSE_RECEIPTS_BUCKET = "expense-receipts";
const HOUSEHOLD_EXPORTS_BUCKET = "household-exports";
const SIGNED_URL_EXPIRES_SEC = 60 * 15;

export async function createMaintenanceEvidenceSignedUrl(
  storagePath: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(MAINTENANCE_EVIDENCE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_SEC);
  if (error) return null;
  return data.signedUrl;
}

export async function createGovernanceAttachmentSignedUrl(
  storagePath: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(GOVERNANCE_ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_SEC);
  if (error) return null;
  return data.signedUrl;
}

export async function createCalendarAttachmentSignedUrl(
  storagePath: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(CALENDAR_ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_SEC);
  if (error) return null;
  return data.signedUrl;
}

export async function createExpenseReceiptSignedUrl(
  storagePath: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(EXPENSE_RECEIPTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_SEC);
  if (error) return null;
  return data.signedUrl;
}

export async function createHouseholdExportSignedUrl(
  storagePath: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(HOUSEHOLD_EXPORTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_SEC);
  if (error) return null;
  return data.signedUrl;
}

export {
  MAINTENANCE_EVIDENCE_BUCKET,
  GOVERNANCE_ATTACHMENTS_BUCKET,
  CALENDAR_ATTACHMENTS_BUCKET,
  EXPENSE_RECEIPTS_BUCKET,
  HOUSEHOLD_EXPORTS_BUCKET,
};
