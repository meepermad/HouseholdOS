import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env/server";
import { authorizeNotificationWorker } from "@/lib/notifications/auth-worker";
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

export async function POST(request: Request) {
  const env = getServerEnv();
  const auth = authorizeNotificationWorker(
    request,
    env.NOTIFICATION_WORKER_SECRET,
  );
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

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
