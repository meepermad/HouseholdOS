"use client";

import { ActionForm } from "@/components/action-form";
import {
  removeMaintenanceEvidenceAction,
  uploadMaintenanceEvidenceAction,
} from "@/app/actions/maintenance";

type Attachment = {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  signedUrl: string | null;
};

export function MaintenanceEvidenceUploader({
  householdId,
  requestId,
  attachments,
}: {
  householdId: string;
  requestId: string;
  attachments: Attachment[];
}) {
  return (
    <div className="space-y-6">
      <ActionForm
        action={uploadMaintenanceEvidenceAction}
        className="space-y-3 rounded-md border border-border p-4"
      >
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="requestId" value={requestId} />
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Upload evidence</span>
          <input
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            required
            className="block w-full text-sm"
          />
        </label>
        <p className="text-xs text-text-secondary">
          JPEG, PNG, WebP, or PDF up to 8 MB. Files are private to authorized
          household viewers.
        </p>
        <button
          type="submit"
          className="min-h-11 rounded-md bg-primary px-4 text-sm text-primary-foreground"
        >
          Upload
        </button>
      </ActionForm>

      <ul className="space-y-3">
        {attachments.map((att) => (
          <li
            key={att.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
          >
            <div>
              <p className="font-medium">{att.file_name}</p>
              <p className="text-xs text-text-secondary">
                {att.mime_type} · {Math.round(att.size_bytes / 1024)} KB
              </p>
              {att.signedUrl ? (
                <a
                  href={att.signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm underline"
                >
                  Open signed link
                </a>
              ) : (
                <p className="text-xs text-text-secondary">
                  Signed URL unavailable
                </p>
              )}
            </div>
            <ActionForm action={removeMaintenanceEvidenceAction}>
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="requestId" value={requestId} />
              <input type="hidden" name="attachmentId" value={att.id} />
              <button
                type="submit"
                className="min-h-11 rounded-md border border-border px-3 text-sm"
              >
                Remove
              </button>
            </ActionForm>
          </li>
        ))}
      </ul>
      {attachments.length === 0 ? (
        <p className="text-sm text-text-secondary">No evidence uploaded yet.</p>
      ) : null}
    </div>
  );
}
