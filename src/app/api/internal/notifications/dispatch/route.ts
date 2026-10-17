import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env/server";
import { authorizeAnyWorkerSecret } from "@/lib/notifications/auth-worker";
import { dispatchNotificationDeliveries } from "@/lib/notifications/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Simple global rate limit for the internal dispatch endpoint. */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 180;
const recentCalls: number[] = [];

function acceptRateLimit(): boolean {
  const now = Date.now();
  while (recentCalls.length > 0 && now - recentCalls[0]! >= RATE_WINDOW_MS) {
    recentCalls.shift();
  }
  if (recentCalls.length >= RATE_MAX) {
    return false;
  }
  recentCalls.push(now);
  return true;
}

function authorizeDispatch(request: Request) {
  const env = getServerEnv();
  return authorizeAnyWorkerSecret(
    request,
    [env.NOTIFICATION_WORKER_SECRET, process.env.CRON_SECRET],
    "Notification",
  );
}

async function runDispatch(request: Request) {
  const auth = authorizeDispatch(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!acceptRateLimit()) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 },
    );
  }

  const summary = await dispatchNotificationDeliveries();
  return NextResponse.json(summary);
}

/** Worker callers use POST. Vercel Cron invokes GET with the cron secret. */
export async function POST(request: Request) {
  return runDispatch(request);
}

export async function GET(request: Request) {
  return runDispatch(request);
}
