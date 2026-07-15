import { CalendarEventCard } from "@/components/calendar/CalendarEventCard";
import { CalendarEmptyState } from "@/components/calendar/CalendarEmptyState";
import {
  formatDayHeading,
  groupOccurrencesByDay,
  todayKeyInTz,
} from "@/lib/calendar/display";
import { DEFAULT_TIMEZONE } from "@/lib/time";
import type { CalendarOccurrence } from "@/lib/calendar/queries";

export function CalendarAgenda({
  householdId,
  occurrences,
  canCreate,
  timeZone = DEFAULT_TIMEZONE,
}: {
  householdId: string;
  occurrences: CalendarOccurrence[];
  canCreate: boolean;
  timeZone?: string;
}) {
  const groups = groupOccurrencesByDay(occurrences);
  if (groups.length === 0) {
    return <CalendarEmptyState householdId={householdId} canCreate={canCreate} />;
  }

  const today = todayKeyInTz(timeZone);

  return (
    <ol className="space-y-6">
      {groups.map((group) => (
        <li key={group.dayKey} className="space-y-2">
          <h2 className="flex items-baseline gap-2 text-sm font-semibold text-text-primary">
            {formatDayHeading(group.dayKey)}
            {group.dayKey === today ? (
              <span className="rounded-full bg-surface-interactive px-2 py-0.5 text-xs font-medium text-primary">
                Today
              </span>
            ) : null}
          </h2>

          {group.allDay.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                All day
              </p>
              <div className="space-y-1.5">
                {group.allDay.map((occ) => (
                  <CalendarEventCard
                    key={occ.occurrenceId}
                    householdId={householdId}
                    occurrence={occ}
                    showTime={false}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {group.timed.length > 0 ? (
            <div className="space-y-1.5">
              {group.timed.map((occ) => (
                <CalendarEventCard
                  key={occ.occurrenceId}
                  householdId={householdId}
                  occurrence={occ}
                />
              ))}
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
