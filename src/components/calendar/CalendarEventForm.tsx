"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { GuestCountControl } from "@/components/calendar/GuestCountControl";
import {
  createCalendarEventAction,
  updateCalendarEventAction,
} from "@/app/actions/calendar";
import {
  CALENDAR_CATEGORIES,
  CALENDAR_CATEGORY_LABELS,
  type CalendarCategory,
} from "@/lib/calendar/categories";
import {
  CALENDAR_VISIBILITIES,
  CALENDAR_VISIBILITY_LABELS,
  type CalendarVisibility,
} from "@/lib/calendar/visibility";
import { REMINDER_PRESETS_MINUTES } from "@/lib/calendar/reminders";
import {
  buildRruleString,
  type RecurrenceEnd,
  type RecurrenceInput,
} from "@/lib/calendar/recurrence";
import {
  getZonedParts,
  zonedWallClockToUtc,
} from "@/lib/calendar/time-mode";
import { DEFAULT_TIMEZONE } from "@/lib/time";

type Weekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";
const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: "MO", label: "Mon" },
  { value: "TU", label: "Tue" },
  { value: "WE", label: "Wed" },
  { value: "TH", label: "Thu" },
  { value: "FR", label: "Fri" },
  { value: "SA", label: "Sat" },
  { value: "SU", label: "Sun" },
];

type RecurrenceMode =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "custom"
  | "keep";

function reminderLabel(minutes: number): string {
  if (minutes === 0) return "At start";
  if (minutes < 60) return `${minutes} min before`;
  if (minutes < 1440) return `${minutes / 60} hr before`;
  if (minutes === 1440) return "1 day before";
  if (minutes % 10080 === 0) return `${minutes / 10080} wk before`;
  return `${minutes / 1440} days before`;
}

export type CalendarEventFormInitial = {
  eventId: string;
  title: string;
  description: string | null;
  location: string | null;
  category: CalendarCategory;
  visibility: CalendarVisibility;
  allDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  startDate: string | null;
  endDateExclusive: string | null;
  timeZone: string;
  rrule: string | null;
  eventGuestCount: number;
  guestLabel: string | null;
  attendeeMembershipIds: string[];
  reminderOffsets: number[];
};

function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days));
  return dt.toISOString().slice(0, 10);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CalendarEventForm({
  householdId,
  members,
  currentMembershipId,
  defaultTimeZone = DEFAULT_TIMEZONE,
  initial,
  canOverride = false,
  viewerIsOrganizer = true,
}: {
  householdId: string;
  members: { id: string; label: string }[];
  currentMembershipId: string;
  defaultTimeZone?: string;
  initial?: CalendarEventFormInitial;
  canOverride?: boolean;
  viewerIsOrganizer?: boolean;
}) {
  const tz = initial?.timeZone ?? defaultTimeZone;

  const initialStart = useMemo(() => {
    if (initial && !initial.allDay && initial.startsAt) {
      const p = getZonedParts(new Date(initial.startsAt), tz);
      return {
        date: `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`,
        time: `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`,
      };
    }
    return { date: todayKey(), time: "18:00" };
  }, [initial, tz]);

  const initialEnd = useMemo(() => {
    if (initial && !initial.allDay && initial.endsAt) {
      const p = getZonedParts(new Date(initial.endsAt), tz);
      return {
        date: `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`,
        time: `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`,
      };
    }
    return { date: todayKey(), time: "19:00" };
  }, [initial, tz]);

  const [allDay, setAllDay] = useState(initial?.allDay ?? false);
  const [startDate, setStartDate] = useState(
    initial?.allDay ? (initial.startDate ?? todayKey()) : initialStart.date,
  );
  const [startTime, setStartTime] = useState(initialStart.time);
  const [endDate, setEndDate] = useState(
    initial?.allDay
      ? initial.endDateExclusive
        ? addDaysToDateKey(initial.endDateExclusive, -1)
        : todayKey()
      : initialEnd.date,
  );
  const [endTime, setEndTime] = useState(initialEnd.time);
  const [timeZone, setTimeZone] = useState(tz);

  const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceMode>(
    initial?.rrule ? "keep" : "none",
  );
  const [interval, setIntervalValue] = useState(1);
  const [weekdays, setWeekdays] = useState<Weekday[]>([]);
  const [endType, setEndType] = useState<"never" | "until" | "count">("never");
  const [untilDate, setUntilDate] = useState("");
  const [count, setCount] = useState(10);

  const [attendees, setAttendees] = useState<string[]>(
    initial?.attendeeMembershipIds ?? [],
  );
  const [reminders, setReminders] = useState<number[]>(
    initial?.reminderOffsets ?? [60],
  );

  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const computedStartIso = useMemo(() => {
    if (allDay) return "";
    const [y, m, d] = startDate.split("-").map(Number);
    const [hh, mm] = startTime.split(":").map(Number);
    return zonedWallClockToUtc(
      { year: y ?? 1970, month: m ?? 1, day: d ?? 1, hour: hh ?? 0, minute: mm ?? 0 },
      timeZone,
    ).toISOString();
  }, [allDay, startDate, startTime, timeZone]);

  const computedEndIso = useMemo(() => {
    if (allDay) return "";
    const [y, m, d] = endDate.split("-").map(Number);
    const [hh, mm] = endTime.split(":").map(Number);
    return zonedWallClockToUtc(
      { year: y ?? 1970, month: m ?? 1, day: d ?? 1, hour: hh ?? 0, minute: mm ?? 0 },
      timeZone,
    ).toISOString();
  }, [allDay, endDate, endTime, timeZone]);

  const endDateExclusive = useMemo(
    () => (allDay ? addDaysToDateKey(endDate, 1) : ""),
    [allDay, endDate],
  );

  const rrule = useMemo(() => {
    if (recurrenceMode === "none") return "";
    if (recurrenceMode === "keep") return initial?.rrule ?? "";

    const end: RecurrenceEnd =
      endType === "until" && untilDate
        ? { type: "until", untilDate }
        : endType === "count"
          ? { type: "count", count }
          : { type: "never" };

    let input: RecurrenceInput;
    if (recurrenceMode === "custom") {
      input = {
        frequency: "weekly",
        interval: Math.max(1, interval),
        byWeekday: weekdays.length > 0 ? weekdays : undefined,
        end,
      };
    } else {
      input = {
        frequency: recurrenceMode,
        interval: Math.max(1, interval),
        end,
      };
    }

    const seedDateKey = allDay ? startDate : startDate;
    const [y, m, d] = seedDateKey.split("-").map(Number);
    const [hh, mm] = allDay ? [12, 0] : startTime.split(":").map(Number);
    const seed = zonedWallClockToUtc(
      { year: y ?? 1970, month: m ?? 1, day: d ?? 1, hour: hh ?? 12, minute: mm ?? 0 },
      timeZone,
    );
    try {
      return buildRruleString(input, seed, timeZone) ?? "";
    } catch {
      return "";
    }
  }, [
    recurrenceMode,
    initial?.rrule,
    endType,
    untilDate,
    count,
    interval,
    weekdays,
    allDay,
    startDate,
    startTime,
    timeZone,
  ]);

  function toggleAttendee(id: string) {
    setAttendees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleWeekday(day: Weekday) {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((x) => x !== day) : [...prev, day],
    );
  }

  function toggleReminder(minutes: number) {
    setReminders((prev) =>
      prev.includes(minutes)
        ? prev.filter((x) => x !== minutes)
        : [...prev, minutes].slice(-5),
    );
  }

  const isEdit = Boolean(initial);
  const showOverride = isEdit && canOverride && !viewerIsOrganizer;

  const inputClass =
    "mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2 text-sm text-text-primary";

  return (
    <ActionForm
      action={isEdit ? updateCalendarEventAction : createCalendarEventAction}
      className="space-y-5"
      pendingLabel={isEdit ? "Saving event…" : "Creating event…"}
    >
      <input type="hidden" name="householdId" value={householdId} />
      {isEdit ? (
        <input type="hidden" name="eventId" value={initial!.eventId} />
      ) : (
        <input type="hidden" name="clientIdempotencyKey" value={idempotencyKey} />
      )}
      <input type="hidden" name="allDay" value={allDay ? "true" : "false"} />
      <input type="hidden" name="timeZone" value={timeZone} />
      {!allDay ? (
        <>
          <input type="hidden" name="startsAt" value={computedStartIso} />
          <input type="hidden" name="endsAt" value={computedEndIso} />
        </>
      ) : (
        <>
          <input type="hidden" name="startDate" value={startDate} />
          <input type="hidden" name="endDateExclusive" value={endDateExclusive} />
        </>
      )}
      <input type="hidden" name="rrule" value={rrule} />
      <input type="hidden" name="attendeesJson" value={JSON.stringify(attendees)} />
      <input type="hidden" name="remindersJson" value={JSON.stringify(reminders)} />
      {showOverride ? (
        <input type="hidden" name="coordinatorOverride" value="true" />
      ) : null}

      {/* Essentials */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-text-primary">
          Title
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={initial?.title ?? ""}
            className={inputClass}
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-text-primary">
            Category
            <select
              name="category"
              defaultValue={initial?.category ?? "other"}
              className={inputClass}
            >
              {CALENDAR_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CALENDAR_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-text-primary">
            Visibility
            <select
              name="visibility"
              defaultValue={initial?.visibility ?? "household"}
              className={inputClass}
            >
              {CALENDAR_VISIBILITIES.map((v) => (
                <option key={v} value={v}>
                  {CALENDAR_VISIBILITY_LABELS[v]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* When */}
      <fieldset className="space-y-3 rounded-md border border-border bg-surface p-4">
        <legend className="px-1 text-sm font-semibold text-text-primary">
          When
        </legend>

        <label className="inline-flex items-center gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
          All-day event
        </label>

        {allDay ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-text-primary">
              Start date
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-text-primary">
              End date
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-text-primary">
                Starts
                <div className="mt-1 flex gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="min-h-11 flex-1 rounded-md border border-border bg-input-bg px-3 py-2 text-sm"
                  />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="min-h-11 w-28 rounded-md border border-border bg-input-bg px-3 py-2 text-sm"
                  />
                </div>
              </label>
              <label className="block text-sm font-medium text-text-primary">
                Ends
                <div className="mt-1 flex gap-2">
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="min-h-11 flex-1 rounded-md border border-border bg-input-bg px-3 py-2 text-sm"
                  />
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="min-h-11 w-28 rounded-md border border-border bg-input-bg px-3 py-2 text-sm"
                  />
                </div>
              </label>
            </div>
          </div>
        )}

        <label className="block text-sm font-medium text-text-primary">
          Timezone
          <input
            value={timeZone}
            onChange={(e) => setTimeZone(e.target.value)}
            className={inputClass}
            placeholder="America/Chicago"
          />
        </label>
      </fieldset>

      {/* Recurrence */}
      <fieldset className="space-y-3 rounded-md border border-border bg-surface p-4">
        <legend className="px-1 text-sm font-semibold text-text-primary">
          Repeat
        </legend>
        <label className="block text-sm font-medium text-text-primary">
          Recurrence
          <select
            value={recurrenceMode}
            onChange={(e) => setRecurrenceMode(e.target.value as RecurrenceMode)}
            className={inputClass}
          >
            {initial?.rrule ? (
              <option value="keep">Keep current recurrence</option>
            ) : null}
            <option value="none">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="custom">Custom (specific weekdays)</option>
          </select>
        </label>

        {recurrenceMode !== "none" && recurrenceMode !== "keep" ? (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-text-primary">
              Every
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={interval}
                  onChange={(e) => setIntervalValue(Number(e.target.value))}
                  className="min-h-11 w-20 rounded-md border border-border bg-input-bg px-3 py-2 text-sm tabular-nums"
                />
                <span className="text-sm text-text-secondary">
                  {recurrenceMode === "custom" ? "week(s)" : `${recurrenceMode.replace("ly", "")}(s)`}
                </span>
              </div>
            </label>

            {recurrenceMode === "custom" ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-text-primary">
                  On days
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((w) => (
                    <button
                      key={w.value}
                      type="button"
                      onClick={() => toggleWeekday(w.value)}
                      aria-pressed={weekdays.includes(w.value)}
                      className={`inline-flex min-h-11 items-center rounded-md border px-3 py-1.5 text-sm ${
                        weekdays.includes(w.value)
                          ? "border-primary bg-surface-interactive text-primary"
                          : "border-border bg-surface text-text-secondary"
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : null}

            <label className="block text-sm font-medium text-text-primary">
              Ends
              <select
                value={endType}
                onChange={(e) =>
                  setEndType(e.target.value as "never" | "until" | "count")
                }
                className={inputClass}
              >
                <option value="never">Never</option>
                <option value="until">On date</option>
                <option value="count">After N times</option>
              </select>
            </label>
            {endType === "until" ? (
              <input
                type="date"
                value={untilDate}
                onChange={(e) => setUntilDate(e.target.value)}
                className={inputClass}
                aria-label="Repeat until date"
              />
            ) : null}
            {endType === "count" ? (
              <input
                type="number"
                min={1}
                max={520}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="min-h-11 w-24 rounded-md border border-border bg-input-bg px-3 py-2 text-sm tabular-nums"
                aria-label="Number of occurrences"
              />
            ) : null}
          </div>
        ) : null}
      </fieldset>

      {/* Details */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-text-primary">
          Location (optional)
          <input
            name="location"
            maxLength={500}
            defaultValue={initial?.location ?? ""}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-text-primary">
          Description (optional)
          <textarea
            name="description"
            rows={3}
            maxLength={4000}
            defaultValue={initial?.description ?? ""}
            className={inputClass}
          />
        </label>
      </div>

      {/* Attendees */}
      {members.length > 0 ? (
        <fieldset className="space-y-2 rounded-md border border-border bg-surface p-4">
          <legend className="px-1 text-sm font-semibold text-text-primary">
            Invite household members
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {members
              .filter((m) => m.id !== currentMembershipId)
              .map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleAttendee(m.id)}
                  aria-pressed={attendees.includes(m.id)}
                  className={`inline-flex min-h-11 items-center rounded-md border px-3 py-1.5 text-sm ${
                    attendees.includes(m.id)
                      ? "border-primary bg-surface-interactive text-primary"
                      : "border-border bg-surface text-text-secondary"
                  }`}
                >
                  {m.label}
                </button>
              ))}
          </div>
        </fieldset>
      ) : null}

      {/* Guests */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <GuestCountControl
          name="eventGuestCount"
          defaultValue={initial?.eventGuestCount ?? 0}
          label="Extra guests (organizer)"
          hint="People outside the household you expect to attend."
        />
        <label className="block text-sm font-medium text-text-primary">
          Guest label (optional)
          <input
            name="guestLabel"
            maxLength={120}
            defaultValue={initial?.guestLabel ?? ""}
            placeholder="e.g. plus-ones"
            className={inputClass}
          />
        </label>
      </div>

      {/* Reminders */}
      <fieldset className="space-y-2 rounded-md border border-border bg-surface p-4">
        <legend className="px-1 text-sm font-semibold text-text-primary">
          Reminders
        </legend>
        <p className="text-xs text-text-muted">Choose up to 5.</p>
        <div className="flex flex-wrap gap-1.5">
          {REMINDER_PRESETS_MINUTES.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => toggleReminder(minutes)}
              aria-pressed={reminders.includes(minutes)}
              className={`inline-flex min-h-11 items-center rounded-md border px-3 py-1.5 text-sm ${
                reminders.includes(minutes)
                  ? "border-primary bg-surface-interactive text-primary"
                  : "border-border bg-surface text-text-secondary"
              }`}
            >
              {reminderLabel(minutes)}
            </button>
          ))}
        </div>
      </fieldset>

      <SubmitButton pendingLabel={isEdit ? "Saving event…" : "Creating event…"}>
        {isEdit ? "Save event" : "Create event"}
      </SubmitButton>
    </ActionForm>
  );
}
