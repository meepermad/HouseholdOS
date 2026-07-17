import { redirect } from "next/navigation";
import {
  normalizeCalendarView,
  renderCalendarViewPage,
} from "@/app/(protected)/app/[householdId]/calendar/calendar-view";

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
    redirect(
      `/app/${householdId}/calendar/agenda${dateParam ? `?date=${dateParam}` : ""}`,
    );
  }
  return renderCalendarViewPage({ householdId, view, dateParam });
}
