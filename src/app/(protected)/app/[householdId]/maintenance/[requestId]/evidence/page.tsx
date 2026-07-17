import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createMaintenanceEvidenceSignedUrl } from "@/lib/storage/signed-urls";
import { MaintenanceEvidenceUploader } from "@/components/maintenance/MaintenanceEvidenceUploader";

export default async function MaintenanceEvidencePage({
  params,
}: {
  params: Promise<{ householdId: string; requestId: string }>;
}) {
  const { householdId, requestId } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { data: request } = await supabase
    .from("maintenance_requests")
    .select("id, household_id, title")
    .eq("id", requestId)
    .maybeSingle();
  if (!request || request.household_id !== householdId) notFound();

  const { data: rows } = await supabase
    .from("maintenance_attachments")
    .select("id, file_name, mime_type, size_bytes, storage_path")
    .eq("request_id", requestId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const attachments = await Promise.all(
    (rows ?? []).map(
      async (row: {
        id: string;
        file_name: string;
        mime_type: string;
        size_bytes: number;
        storage_path: string;
      }) => ({
        id: row.id,
        file_name: row.file_name,
        mime_type: row.mime_type,
        size_bytes: row.size_bytes,
        signedUrl: await createMaintenanceEvidenceSignedUrl(row.storage_path),
      }),
    ),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6 pb-24">
      <Link
        href={`/app/${householdId}/maintenance/${requestId}`}
        className="text-sm text-text-secondary"
      >
        ← {request.title}
      </Link>
      <h1 className="text-2xl font-semibold">Evidence</h1>
      <MaintenanceEvidenceUploader
        householdId={householdId}
        requestId={requestId}
        attachments={attachments}
      />
    </div>
  );
}
