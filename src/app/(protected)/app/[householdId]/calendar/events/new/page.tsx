import { redirect } from "next/navigation";
import { householdRoutes } from "@/lib/routes/household";

export const dynamic = "force-dynamic";

/** Compatibility: `/calendar/events/new` → `/calendar/new`. */
export default async function LegacyCalendarEventsNewRedirect({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  redirect(householdRoutes.calendar.new(householdId));
}
