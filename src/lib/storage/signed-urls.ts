import { createClient } from "@/lib/supabase/server";

const MAINTENANCE_EVIDENCE_BUCKET = "maintenance-evidence";
const GOVERNANCE_ATTACHMENTS_BUCKET = "governance-attachments";
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

export { MAINTENANCE_EVIDENCE_BUCKET, GOVERNANCE_ATTACHMENTS_BUCKET };
