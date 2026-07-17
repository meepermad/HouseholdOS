import { notFound } from "next/navigation";
import { assertActiveMembership } from "@/lib/household-context";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getEventDetail, listActiveMembers } from "@/lib/calendar/queries";
import { CalendarEventForm } from "@/components/calendar/CalendarEventForm";
import { AppBackButton } from "@/components/app-back-button";
import { DEFAULT_TIMEZONE } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function EditCalendarEventPage({
  params,
}: {
  params: Promise<{ householdId: string; eventId: string }>;
}) {
  const { householdId, eventId } = await params;
  const ctx = await assertActiveMembership(householdId);

  const event = await getEventDetail(householdId, eventId, ctx.membershipId);
  if (!event || event.isBusyProjection || event.status === "cancelled") {
    notFound();
  }

  const canOverride =
    can(ctx.roles, "calendar.coordinator_override") &&
    event.visibility === "household";
  const canManage = event.viewerIsOrganizer || canOverride;
  if (!canManage) {
    notFound();
  }

  const supabase = await createClient();
  const [{ data: profile }, members] = await Promise.all([
    supabase
      .from("profiles")
      .select("preferred_timezone")
      .eq("id", ctx.userId)
      .maybeSingle(),
    listActiveMembers(householdId),
  ]);

  const attendeeMembershipIds = event.attendees
    .filter((a) => a.participationRole !== "organizer")
    .map((a) => a.membershipId);

  return (
    <main className="mx-auto max-w-2xl space-y-5">
      <AppBackButton
        fallbackHref={`/app/${householdId}/calendar/event/${eventId}`}
      />
      <header className="space-y-1">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
          Edit event
        </h1>
        <p className="text-sm text-text-secondary">
          Changes update the whole series. Editing a single occurrence is done
          from the event on the calendar.
        </p>
      </header>

      <CalendarEventForm
        householdId={householdId}
        members={members}
        currentMembershipId={ctx.membershipId}
        defaultTimeZone={profile?.preferred_timezone || DEFAULT_TIMEZONE}
        viewerIsOrganizer={event.viewerIsOrganizer}
        canOverride={canOverride}
        initial={{
          eventId: event.eventId,
          title: event.title,
          description: event.description,
          location: event.location,
          category: event.category,
          visibility: event.visibility,
          allDay: event.allDay,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          startDate: event.startDate,
          endDateExclusive: event.endDateExclusive,
          timeZone: event.timeZone,
          rrule: event.rrule,
          eventGuestCount: event.eventGuestCount,
          guestLabel: event.guestLabel,
          attendeeMembershipIds,
          reminderOffsets: event.reminderOffsets,
        }}
      />
    </main>
  );
}
