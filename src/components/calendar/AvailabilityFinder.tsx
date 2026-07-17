"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { findAvailabilityWindows } from "@/lib/calendar/availability";
import { searchAvailabilityAction } from "@/app/actions/calendar";
import {
  formatMinutesAsTime,
  minutesToTimeValue,
  timeValueToMinutes,
} from "@/components/ui/time-field";

type Member = { membershipId: string; displayName: string };

type Suggestion = {
  startsAt: string;
  endsAt: string;
  requiredAvailable: boolean;
  optionalAvailableCount: number;
  conflictCount: number;
  preferenceScore: number;
};

export function AvailabilityFinder({
  householdId,
  members,
  viewerMembershipId,
}: {
  householdId: string;
  members: Member[];
  viewerMembershipId: string;
}) {
  const [required, setRequired] = useState<string[]>([viewerMembershipId]);
  const [optional, setOptional] = useState<string[]>([]);
  const [duration, setDuration] = useState(60);
  const [earliest, setEarliest] = useState(9 * 60);
  const [latest, setLatest] = useState(21 * 60);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const others = useMemo(
    () => members.filter((m) => m.membershipId !== viewerMembershipId),
    [members, viewerMembershipId],
  );

  function toggle(list: string[], id: string, set: (v: string[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function onSearch() {
    setError(null);
    startTransition(async () => {
      const result = await searchAvailabilityAction({
        householdId,
        requiredMembershipIds: required,
        optionalMembershipIds: optional,
        durationMinutes: duration,
        earliestMinute: earliest,
        latestMinute: latest,
      });
      if (!result.ok) {
        setError(result.error);
        setSuggestions([]);
        return;
      }
      setSuggestions(result.suggestions);
    });
  }

  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Required participants</legend>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <label
              key={`req-${m.membershipId}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm"
            >
              <input
                type="checkbox"
                checked={required.includes(m.membershipId)}
                onChange={() => toggle(required, m.membershipId, setRequired)}
              />
              {m.displayName}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Optional participants</legend>
        <div className="flex flex-wrap gap-2">
          {others.map((m) => (
            <label
              key={`opt-${m.membershipId}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm"
            >
              <input
                type="checkbox"
                checked={optional.includes(m.membershipId)}
                onChange={() => toggle(optional, m.membershipId, setOptional)}
              />
              {m.displayName}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="font-medium">Duration (minutes)</span>
          <input
            type="number"
            min={15}
            max={480}
            step={15}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="mt-1 w-full min-h-11 rounded-md border border-border bg-surface px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Earliest time</span>
          <input
            type="time"
            value={minutesToTimeValue(earliest)}
            onChange={(e) => {
              try {
                setEarliest(timeValueToMinutes(e.target.value));
              } catch {
                /* ignore incomplete */
              }
            }}
            className="mt-1 w-full min-h-11 rounded-md border border-border bg-surface px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Latest time</span>
          <input
            type="time"
            value={minutesToTimeValue(latest > 1439 ? 1439 : latest)}
            onChange={(e) => {
              try {
                setLatest(timeValueToMinutes(e.target.value));
              } catch {
                /* ignore incomplete */
              }
            }}
            className="mt-1 w-full min-h-11 rounded-md border border-border bg-surface px-3"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onSearch}
        disabled={pending || required.length === 0}
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Searching…" : "Find windows"}
      </button>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {suggestions.length > 0 ? (
        <ul className="space-y-2" aria-label="Suggested times">
          {suggestions.slice(0, 12).map((s) => {
            const start = new Date(s.startsAt);
            const label = start.toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });
            const qs = new URLSearchParams({
              startsAt: s.startsAt,
              endsAt: s.endsAt,
              attendees: [...required, ...optional].join(","),
            });
            return (
              <li
                key={s.startsAt}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <div>
                  <p className="font-medium tabular-nums">
                    {start.toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p className="text-sm tabular-nums text-text-primary">
                    {formatMinutesAsTime(
                      start.getHours() * 60 + start.getMinutes(),
                    )}
                    –
                    {formatMinutesAsTime(
                      new Date(s.endsAt).getHours() * 60 +
                        new Date(s.endsAt).getMinutes(),
                    )}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {s.requiredAvailable
                      ? "Everyone available"
                      : "Gaps remain"}
                    {s.optionalAvailableCount > 0
                      ? ` · ${s.optionalAvailableCount} optional free`
                      : ""}
                  </p>
                  <span className="sr-only">{label}</span>
                </div>
                <Link
                  href={`/app/${householdId}/calendar/new?${qs.toString()}`}
                  className="inline-flex min-h-11 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
                >
                  Create event
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* Keep client pure helper available for unit-tested offline path */}
      <span className="sr-only">{findAvailabilityWindows.name}</span>
    </div>
  );
}
