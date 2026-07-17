import { NextResponse } from "next/server";
import { assertActiveMembership } from "@/lib/household-context";
import { createClient } from "@/lib/supabase/server";
import { buildIcalendar, type IcsEventInput } from "@/lib/calendar/ics";
import { listOccurrencesInRange } from "@/lib/calendar/queries";

export const dynamic = "force-dynamic";

/** One-shot ICS download for a date range (authenticated). */
export async function GET(
  request: Request,
  context: { params: Promise<{ householdId: string }> },
) {
  const { householdId } = await context.params;
  const ctx = await assertActiveMembership(householdId);
  const url = new URL(request.url);
  const start =
    url.searchParams.get("start") ??
    new Date().toISOString().slice(0, 10) + "T00:00:00.000Z";
  const end =
    url.searchParams.get("end") ??
    new Date(Date.now() + 90 * 86400000).toISOString();

  const occurrences = await listOccurrencesInRange(
    householdId,
    ctx.membershipId,
    start,
    end,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const eventIds = [...new Set(occurrences.map((o) => o.eventId))];
  const { data: events } = eventIds.length
    ? await supabase
        .from("calendar_events")
        .select(
          "id, calendar_uid, sequence, updated_at, title, description, location, status, all_day, starts_at, ends_at, start_date, end_date_exclusive, time_zone, rrule",
        )
        .in("id", eventIds)
    : { data: [] };

  const byId = new Map(
    ((events ?? []) as Array<Record<string, unknown>>).map((e) => [
      e.id as string,
      e,
    ]),
  );

  const icsEvents: IcsEventInput[] = [];
  for (const occ of occurrences) {
    if (occ.isBusyProjection) continue;
    const master = byId.get(occ.eventId);
    if (!master) continue;
    icsEvents.push({
      uid: `${master.calendar_uid as string}-${occ.originalStartsAt}`,
      sequence: master.sequence as number,
      lastModified: master.updated_at as string,
      summary: occ.title,
      description: occ.description,
      location: occ.location,
      status: occ.cancelled ? "CANCELLED" : "CONFIRMED",
      allDay: occ.allDay,
      startsAt: occ.allDay ? null : occ.startsAt,
      endsAt: occ.allDay ? null : occ.endsAt,
      startDate: occ.startDate,
      endDateExclusive: occ.endDateExclusive,
      timeZone: occ.timeZone,
      rrule: null,
      url: `${url.origin}/app/${householdId}/calendar/event/${occ.eventId}`,
    });
  }

  const body = buildIcalendar({
    calendarName: "HouseholdOS export",
    events: icsEvents,
  });

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="householdos-${householdId.slice(0, 8)}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
