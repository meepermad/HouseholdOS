import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { createClient } from "@/lib/supabase/server";
import { AppBackButton } from "@/components/app-back-button";
import { RsvpControl } from "@/components/calendar/RsvpControl";

export const dynamic = "force-dynamic";

type PendingInvite = {
  event_id: string;
  rsvp_status: string;
  needs_reconfirmation: boolean;
  event: {
    id: string;
    title: string;
    starts_at: string | null;
    start_date: string | null;
    status: string;
    all_day: boolean;
  } | null;
};

export default async function CalendarInvitationsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const { data } = await supabase
    .from("calendar_event_attendees")
    .select(
      `event_id, rsvp_status, needs_reconfirmation,
       event:calendar_events!calendar_event_attendees_event_id_household_id_fkey!inner(id, title, starts_at, start_date, status, all_day)`,
    )
    .eq("membership_id", ctx.membershipId)
    .eq("household_id", householdId)
    .or("rsvp_status.eq.needs_action,needs_reconfirmation.eq.true");

  const rows = ((data ?? []) as PendingInvite[]).filter(
    (r) => r.event && r.event.status === "scheduled",
  );

  return (
    <div className="space-y-4">
      <AppBackButton fallbackHref={`/app/${householdId}/calendar`} />
      <header className="space-y-1">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
          Invitations
        </h1>
        <p className="text-sm text-text-secondary">
          Pending RSVPs and events that need reconfirmation after a time or
          location change.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-text-secondary">
          No pending invitations.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const ev = row.event!;
            return (
              <li
                key={row.event_id}
                className="rounded-md border border-border bg-surface px-4 py-3 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/app/${householdId}/calendar/event/${ev.id}`}
                      className="font-medium text-text-primary hover:underline"
                    >
                      {ev.title}
                    </Link>
                    {row.needs_reconfirmation ? (
                      <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                        Details changed — please reconfirm your RSVP
                      </p>
                    ) : null}
                  </div>
                </div>
                <RsvpControl
                  householdId={householdId}
                  eventId={ev.id}
                  currentStatus={
                    row.rsvp_status as
                      | "needs_action"
                      | "going"
                      | "maybe"
                      | "not_going"
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
