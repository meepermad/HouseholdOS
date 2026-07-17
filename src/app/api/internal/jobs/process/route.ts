import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env/server";
import { authorizeNotificationWorker } from "@/lib/notifications/auth-worker";
import { processReceiptExtractionJobs } from "@/lib/receipts/worker";
import { processHouseholdExportJobs } from "@/lib/export/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Internal worker for receipt OCR + household export jobs.
 * Reuses the notification worker secret.
 */
export async function POST(request: Request) {
  const env = getServerEnv();
  const auth = authorizeNotificationWorker(
    request,
    env.NOTIFICATION_WORKER_SECRET,
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const receipts = await processReceiptExtractionJobs();
  const exports = await processHouseholdExportJobs();
  return NextResponse.json({ receipts, exports });
}
