import { assertActiveMembership } from "@/lib/household-context";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { listOccurrencesInRange } from "@/lib/calendar/queries";
import { CalendarShell } from "@/components/calendar/CalendarShell";
import { CalendarAgenda } from "@/components/calendar/CalendarAgenda";
import { CalendarMonth } from "@/components/calendar/CalendarMonth";
import { CalendarWeek } from "@/components/calendar/CalendarWeek";
import { AppBackButton } from "@/components/app-back-button";
import {
  formatShortDay,
  monthGridRange,
  todayKeyInTz,
} from "@/lib/calendar/display";
import { DEFAULT_TIMEZONE } from "@/lib/time";
import type { CalendarView } from "@/components/calendar/CalendarToolbar";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const AGENDA_WINDOW_DAYS = 45;

function normalizeView(value: string | undefined): CalendarView {
  return value === "month" || value === "week" ? value : "agenda";
}

function dayStartIso(dayKey: string): string {
  return `${dayKey}T00:00:00.000Z`;
}

function shiftDayKey(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days));
  return dt.toISOString().slice(0, 10);
}

function shiftMonthKey(dayKey: string, months: number): string {
  const [y, m] = dayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1 + months, 1));
  return dt.toISOString().slice(0, 10);
}

function weekDayKeys(anchor: string): string[] {
  const [y, m, d] = anchor.split("-").map(Number);
  const base = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  const start = new Date(base);
  start.setUTCDate(base.getUTCDate() - base.getUTCDay());
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(start);
    dt.setUTCDate(start.getUTCDate() + i);
    return dt.toISOString().slice(0, 10);
  });
}

function monthHeading(dayKey: string): string {
  const [y, m] = dayKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, 1)));
}

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string }>;
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const { householdId } = await params;
  const { view: viewParam, date: dateParam } = await searchParams;
  const ctx = await assertActiveMembership(householdId);
  const canCreate = can(ctx.roles, "calendar.create");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_timezone")
    .eq("id", ctx.userId)
    .maybeSingle();
  const timeZone = profile?.preferred_timezone || DEFAULT_TIMEZONE;

  const view = normalizeView(viewParam);
  const anchor =
    dateParam && DATE_RE.test(dateParam) ? dateParam : todayKeyInTz(timeZone);

  let rangeStart: string;
  let rangeEnd: string;
  let heading: string;
  let prevAnchor: string;
  let nextAnchor: string;

  if (view === "month") {
    const grid = monthGridRange(anchor);
    rangeStart = grid.gridStart;
    rangeEnd = grid.gridEnd;
    heading = monthHeading(anchor);
    prevAnchor = shiftMonthKey(anchor, -1);
    nextAnchor = shiftMonthKey(anchor, 1);
  } else if (view === "week") {
    const days = weekDayKeys(anchor);
    rangeStart = dayStartIso(days[0]!);
    rangeEnd = dayStartIso(shiftDayKey(days[6]!, 1));
    heading = `${formatShortDay(days[0]!)} – ${formatShortDay(days[6]!)}`;
    prevAnchor = shiftDayKey(anchor, -7);
    nextAnchor = shiftDayKey(anchor, 7);
  } else {
    rangeStart = dayStartIso(anchor);
    rangeEnd = dayStartIso(shiftDayKey(anchor, AGENDA_WINDOW_DAYS));
    heading = "Agenda";
    prevAnchor = shiftDayKey(anchor, -AGENDA_WINDOW_DAYS);
    nextAnchor = shiftDayKey(anchor, AGENDA_WINDOW_DAYS);
  }

  const occurrences = await listOccurrencesInRange(
    householdId,
    ctx.membershipId,
    rangeStart,
    rangeEnd,
  );

  const base = `/app/${householdId}/calendar?view=${view}`;
  const prevHref = `${base}&date=${prevAnchor}`;
  const nextHref = `${base}&date=${nextAnchor}`;
  const todayHref = `${base}&date=${todayKeyInTz(timeZone)}`;

  return (
    <div className="space-y-4">
      <AppBackButton fallbackHref={`/app/${householdId}`} />
      <CalendarShell
        householdId={householdId}
        view={view}
        heading={heading}
        prevHref={prevHref}
        nextHref={nextHref}
        todayHref={todayHref}
        canCreate={canCreate}
      >
        {view === "month" ? (
          <CalendarMonth
            householdId={householdId}
            anchorDayKey={anchor}
            occurrences={occurrences}
            timeZone={timeZone}
          />
        ) : view === "week" ? (
          <div className="overflow-x-auto">
            <div className="min-w-[56rem]">
              <CalendarWeek
                householdId={householdId}
                weekDayKeys={weekDayKeys(anchor)}
                occurrences={occurrences}
                timeZone={timeZone}
              />
            </div>
          </div>
        ) : (
          <CalendarAgenda
            householdId={householdId}
            occurrences={occurrences}
            canCreate={canCreate}
            timeZone={timeZone}
          />
        )}
      </CalendarShell>
    </div>
  );
}
