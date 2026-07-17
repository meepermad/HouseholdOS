import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env/server";
import { authorizeWorkerSecret } from "@/lib/notifications/auth-worker";
import { processHouseholdExportJobs } from "@/lib/export/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Internal worker for household export archive jobs. */
export async function POST(request: Request) {
  const env = getServerEnv();
  const auth = authorizeWorkerSecret(
    request,
    env.EXPORT_WORKER_SECRET,
    "Export",
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const exports = await processHouseholdExportJobs();
  return NextResponse.json({ exports });
}
