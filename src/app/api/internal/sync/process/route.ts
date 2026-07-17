import { NextResponse } from "next/server";
import { authorizeWorkerSecret } from "@/lib/notifications/auth-worker";
import { getServerEnv } from "@/lib/env/server";

/**
 * SYNC_WORKER_SECRET-gated catch-up endpoint reserved for server-side sync jobs.
 * Currently health/ack only until pull-cursor workers are required.
 */
export async function POST(request: Request) {
  const env = getServerEnv();
  const auth = authorizeWorkerSecret(
    request,
    env.SYNC_WORKER_SECRET,
    "sync",
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({
    ok: true,
    status: "idle",
    message: "Sync worker endpoint ready; no pending server catch-up jobs.",
  });
}
