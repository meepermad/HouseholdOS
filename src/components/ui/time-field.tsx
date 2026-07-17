"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/field";

export function minutesToTimeValue(minutes: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.trunc(minutes)));
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function timeValueToMinutes(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) throw new Error("Invalid time");
  const hours = Number.parseInt(match[1], 10);
  const mins = Number.parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || mins < 0 || mins > 59) {
    throw new Error("Invalid time");
  }
  return hours * 60 + mins;
}

export function formatMinutesAsTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.trunc(minutes)));
  const hours24 = Math.floor(clamped / 60);
  const mins = clamped % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, "0")} ${period}`;
}

export function TimeField({
  label,
  name,
  defaultMinutes = 9 * 60,
  hint,
  error,
  required,
  disabled,
  id: idProp,
}: {
  label: string;
  name: string;
  defaultMinutes?: number;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [value, setValue] = useState(minutesToTimeValue(defaultMinutes));
  const [minutes, setMinutes] = useState(defaultMinutes);
  const [localError, setLocalError] = useState<string | null>(null);

  const shownError = error ?? localError;

  return (
    <div className="space-y-1.5" data-testid="time-field">
      <label htmlFor={id} className="block text-sm font-medium text-text-primary">
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </label>
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
      <Input
        id={id}
        type="time"
        disabled={disabled}
        required={required}
        value={value}
        aria-invalid={shownError ? true : undefined}
        aria-describedby={shownError ? `${id}-error` : undefined}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          try {
            setMinutes(timeValueToMinutes(next));
            setLocalError(null);
          } catch {
            setLocalError("Enter a valid time.");
          }
        }}
      />
      <input type="hidden" name={name} value={String(minutes)} />
      {shownError ? (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {shownError}
        </p>
      ) : null}
    </div>
  );
}
