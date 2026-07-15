import { createPrivilegedClient } from "@/lib/supabase/privileged";
import {
  buildCalendarUid,
  hashFeedToken,
  safeEventDeepLink,
  stripFeedTokenSuffix,
} from "@/lib/calendar/feed-token";
import {
  buildIcalendar,
  type IcsEventInput,
} from "@/lib/calendar/ics";
import {
  OCCURRENCE_HORIZON_FUTURE_DAYS,
  OCCURRENCE_HORIZON_PAST_DAYS,
} from "@/lib/calendar/recurrence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Uniform 404 body — never reveal whether a token exists, is revoked, or is
// tied to an inactive membership.
const NOT_FOUND = "Not found";

function notFound(): Response {
  return new Response(NOT_FOUND, {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

// Lightweight in-memory throttle (best-effort; resets on cold start). A durable
// limiter would live in the edge/CDN layer for production hardening.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 240;
const recentCalls: number[] = [];

function acceptRateLimit(): boolean {
  const now = Date.now();
  while (recentCalls.length > 0 && now - recentCalls[0]! >= RATE_WINDOW_MS) {
    recentCalls.shift();
  }
  if (recentCalls.length >= RATE_MAX) return false;
  recentCalls.push(now);
  return true;
}

type FeedContext = {
  feed_id: string;
  user_id: string;
  household_id: string;
  scope: string;
  revoked_at: string | null;
  expires_at: string | null;
  membership_active: boolean;
};

type FeedEventRow = {
  event_id: string;
  household_id: string;
  calendar_uid: string | null;
  title: string;
  description: string | null;
  location: string | null;
  status: string;
  all_day: boolean;
  starts_at: string | null;
  ends_at: string | null;
  start_date: string | null;
  end_date_exclusive: string | null;
  time_zone: string;
  rrule: string | null;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!acceptRateLimit()) {
    return new Response("Too many requests", {
      status: 429,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const { token: rawParam } = await params;
  const rawToken = stripFeedTokenSuffix(rawParam ?? "");
  if (!rawToken || rawToken.length < 16) {
    return notFound();
  }

  const tokenHash = hashFeedToken(rawToken);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = createPrivilegedClient() as any;

  const { data: ctxRows, error: ctxError } = await client.rpc(
    "get_calendar_feed_context",
    { p_token_hash: tokenHash },
  );
  if (ctxError) {
    return notFound();
  }

  const ctx = (Array.isArray(ctxRows) ? ctxRows[0] : ctxRows) as
    | FeedContext
    | undefined;
  if (
    !ctx ||
    ctx.revoked_at !== null ||
    !ctx.membership_active ||
    (ctx.expires_at !== null && new Date(ctx.expires_at).getTime() <= Date.now())
  ) {
    return notFound();
  }

  const now = Date.now();
  const rangeStart = new Date(
    now - OCCURRENCE_HORIZON_PAST_DAYS * 86_400_000,
  ).toISOString();
  const rangeEnd = new Date(
    now + OCCURRENCE_HORIZON_FUTURE_DAYS * 86_400_000,
  ).toISOString();

  const { data: eventRows, error: eventsError } = await client.rpc(
    "list_authorized_feed_events",
    {
      p_feed_id: ctx.feed_id,
      p_range_start: rangeStart,
      p_range_end: rangeEnd,
    },
  );
  if (eventsError) {
    return notFound();
  }

  const origin = new URL(_request.url).origin;
  const events: IcsEventInput[] = ((eventRows ?? []) as FeedEventRow[]).map(
    (row) => {
      const uid =
        row.calendar_uid ??
        buildCalendarUid({
          householdId: row.household_id,
          eventId: row.event_id,
        });
      return {
        uid,
        sequence: 0,
        lastModified: new Date(),
        summary: row.title,
        description: row.description,
        location: row.location,
        status: row.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
        allDay: row.all_day,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        timeZone: row.time_zone,
        startDate: row.start_date,
        endDateExclusive: row.end_date_exclusive,
        rrule: row.rrule,
        url: safeEventDeepLink({
          origin,
          householdId: row.household_id,
          eventId: row.event_id,
        }),
      };
    },
  );

  const body = buildIcalendar({
    calendarName: "HouseholdOS",
    events,
  });

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "cache-control": "private, no-cache",
      "content-disposition": 'inline; filename="householdos.ics"',
    },
  });
}
