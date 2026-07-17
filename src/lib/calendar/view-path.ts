import {
  householdRoutes,
  type CalendarViewSlug,
} from "@/lib/routes/household";

export type CalendarView = CalendarViewSlug;

export const CALENDAR_VIEWS: readonly CalendarView[] = [
  "agenda",
  "day",
  "week",
  "month",
] as const;

export function calendarViewPath(
  householdId: string,
  view: CalendarView,
  date?: string,
): string {
  return householdRoutes.calendar.view(householdId, view, date);
}
