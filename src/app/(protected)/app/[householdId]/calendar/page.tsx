import { redirect } from "next/navigation";
import {
  normalizeCalendarView,
  renderCalendarViewPage,
} from "@/app/(protected)/app/[householdId]/calendar/calendar-view";
import { householdRoutes } from "@/lib/routes/household";

export const dynamic = "force-dynamic";

/** Legacy `?view=` entry — prefer path-based `/calendar/{view}`. */
export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string }>;
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const { householdId } = await params;
  const { view: viewParam, date: dateParam } = await searchParams;
  const view = normalizeCalendarView(viewParam);
  if (!viewParam) {
    redirect(householdRoutes.calendar.agenda(householdId, dateParam));
  }
  return renderCalendarViewPage({ householdId, view, dateParam });
}
