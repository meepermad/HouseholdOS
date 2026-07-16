import {
  defaultHorizon,
  expandOccurrences,
  type ExceptionOverlay,
} from "@/lib/calendar/recurrence";

export type CalendarEventRow = {
  id: string;
  all_day: boolean;
  starts_at: string | null;
  ends_at: string | null;
  start_date: string | null;
  end_date_exclusive: string | null;
  time_zone: string;
  rrule: string | null;
  status: string;
};

export type ExceptionRow = {
  original_starts_at: string;
  kind: "cancelled" | "override";
  starts_at: string | null;
  ends_at: string | null;
  start_date: string | null;
  end_date_exclusive: string | null;
  all_day: boolean | null;
  title?: string | null;
  description?: string | null;
  location?: string | null;
  event_guest_count?: number | null;
  guest_label?: string | null;
  overrides_attendees?: boolean;
  overrides_reminders?: boolean;
};

/**
 * Expand a master event into bounded occurrences and persist via RPC.
 * Idempotent when called repeatedly with the same horizon.
 */
export async function materializeEventOccurrences(params: {
  supabase: {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      };
    };
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  event: CalendarEventRow;
  rangeStart?: Date;
  rangeEnd?: Date;
}): Promise<{ count: number; error: string | null }> {
  if (params.event.status === "cancelled") {
    return { count: 0, error: null };
  }

  const horizon = defaultHorizon();
  const rangeStart = params.rangeStart ?? horizon.rangeStart;
  const rangeEnd = params.rangeEnd ?? horizon.rangeEnd;

  const { data: exceptionRows, error: exErr } = await params.supabase
    .from("calendar_event_exceptions")
    .select(
      "original_starts_at, kind, starts_at, ends_at, start_date, end_date_exclusive, all_day, title, description, location, event_guest_count, guest_label, overrides_attendees, overrides_reminders",
    )
    .eq("event_id", params.event.id);

  if (exErr) return { count: 0, error: exErr.message };

  const exceptions: ExceptionOverlay[] = ((exceptionRows ?? []) as ExceptionRow[]).map(
    (row) => ({
      originalStartsAt: row.original_starts_at,
      kind: row.kind,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      startDate: row.start_date,
      endDateExclusive: row.end_date_exclusive,
      allDay: row.all_day,
      title: row.title,
      description: row.description,
      location: row.location,
      eventGuestCount: row.event_guest_count,
      guestLabel: row.guest_label,
      overridesAttendees: row.overrides_attendees,
      overridesReminders: row.overrides_reminders,
    }),
  );

  const expanded = expandOccurrences({
    allDay: params.event.all_day,
    startsAt: params.event.starts_at,
    endsAt: params.event.ends_at,
    startDate: params.event.start_date,
    endDateExclusive: params.event.end_date_exclusive,
    timeZone: params.event.time_zone,
    rrule: params.event.rrule,
    rangeStart,
    rangeEnd,
    exceptions,
  });

  const payload = expanded.map((occ) => ({
    original_starts_at: occ.originalStartsAt,
    starts_at: occ.startsAt,
    ends_at: occ.endsAt,
    all_day: occ.allDay,
    start_date: occ.startDate,
    end_date_exclusive: occ.endDateExclusive,
    is_cancelled: false,
  }));

  // Include cancelled exceptions so reconcile can mark them cancelled
  for (const ex of exceptions) {
    if (ex.kind !== "cancelled") continue;
    if (payload.some((p) => p.original_starts_at === ex.originalStartsAt)) continue;
    payload.push({
      original_starts_at: ex.originalStartsAt,
      starts_at: ex.startsAt ?? ex.originalStartsAt,
      ends_at: ex.endsAt ?? ex.originalStartsAt,
      all_day: ex.allDay ?? false,
      start_date: ex.startDate ?? null,
      end_date_exclusive: ex.endDateExclusive ?? null,
      is_cancelled: true,
    });
  }

  const { data, error } = await params.supabase.rpc(
    "reconcile_calendar_event_occurrences",
    {
      p_event_id: params.event.id,
      p_occurrences: payload,
    },
  );

  if (error) return { count: 0, error: error.message };
  return { count: typeof data === "number" ? data : payload.length, error: null };
}
