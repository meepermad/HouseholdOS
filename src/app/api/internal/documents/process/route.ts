import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env/server";
import { authorizeWorkerSecret } from "@/lib/notifications/auth-worker";
import { processReceiptExtractionJobs } from "@/lib/receipts/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Internal worker for receipt OCR / document extraction jobs. */
export async function POST(request: Request) {
  const env = getServerEnv();
  const auth = authorizeWorkerSecret(
    request,
    env.DOCUMENT_JOB_WORKER_SECRET,
    "Document job",
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const receipts = await processReceiptExtractionJobs();
  return NextResponse.json({ receipts });
}
