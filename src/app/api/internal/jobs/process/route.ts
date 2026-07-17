import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Legacy combined jobs endpoint — removed in Completion-A.
 * Use family-specific workers with distinct secrets:
 * - POST /api/internal/documents/process (DOCUMENT_JOB_WORKER_SECRET)
 * - POST /api/internal/exports/process (EXPORT_WORKER_SECRET)
 * - POST /api/internal/notifications/dispatch (NOTIFICATION_WORKER_SECRET)
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Combined jobs endpoint retired. Use /api/internal/documents/process or /api/internal/exports/process with the matching worker secret.",
    },
    { status: 410 },
  );
}
