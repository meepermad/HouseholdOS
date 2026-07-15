"use client";

import { useState } from "react";
import { MAX_GUEST_COUNT } from "@/lib/calendar/headcount";

export function GuestCountControl({
  name = "guestCount",
  defaultValue = 0,
  label = "Guests you're bringing",
  hint,
}: {
  name?: string;
  defaultValue?: number;
  label?: string;
  hint?: string;
}) {
  const [count, setCount] = useState(() =>
    Math.min(Math.max(defaultValue, 0), MAX_GUEST_COUNT),
  );

  function clamp(next: number) {
    setCount(Math.min(Math.max(next, 0), MAX_GUEST_COUNT));
  }

  return (
    <div className="space-y-1">
      <span className="block text-sm font-medium text-text-primary">{label}</span>
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={() => clamp(count - 1)}
          aria-label="Decrease guest count"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface text-lg text-text-secondary hover:bg-surface-interactive disabled:opacity-40"
          disabled={count <= 0}
        >
          −
        </button>
        <input
          type="number"
          name={name}
          value={count}
          min={0}
          max={MAX_GUEST_COUNT}
          onChange={(e) => clamp(Number(e.target.value))}
          className="min-h-11 w-16 rounded-md border border-border bg-input-bg px-3 py-2 text-center text-sm tabular-nums text-text-primary"
          aria-label={label}
        />
        <button
          type="button"
          onClick={() => clamp(count + 1)}
          aria-label="Increase guest count"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface text-lg text-text-secondary hover:bg-surface-interactive disabled:opacity-40"
          disabled={count >= MAX_GUEST_COUNT}
        >
          +
        </button>
      </div>
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}
