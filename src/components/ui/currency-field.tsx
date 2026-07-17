"use client";

import { useId, useState } from "react";
import { formatUsdFromCents, parseUsdToCents, type Cents } from "@/lib/money";
import { Input } from "@/components/ui/field";

function centsToInputValue(cents: number | null | undefined): string {
  if (cents == null || Number.isNaN(cents)) return "";
  const abs = Math.abs(cents);
  const dollars = Math.trunc(abs / 100);
  const rem = abs % 100;
  const sign = cents < 0 ? "-" : "";
  return `${sign}${dollars}.${rem.toString().padStart(2, "0")}`;
}

export function CurrencyField({
  label,
  name,
  defaultCents = 0,
  hint,
  error,
  required,
  disabled,
  id: idProp,
  maxCents = 100_000_00,
}: {
  label: string;
  name: string;
  defaultCents?: number;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  maxCents?: number;
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [display, setDisplay] = useState(centsToInputValue(defaultCents));
  const [cents, setCents] = useState(defaultCents);
  const [localError, setLocalError] = useState<string | null>(null);

  function commit(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      setCents(0);
      setDisplay("");
      setLocalError(required ? "Enter an amount." : null);
      return;
    }
    try {
      const parsed = parseUsdToCents(trimmed);
      if (parsed < 0) {
        setLocalError("Amount cannot be negative.");
        return;
      }
      if (parsed > maxCents) {
        setLocalError("Amount is too large.");
        return;
      }
      setCents(parsed);
      setDisplay(centsToInputValue(parsed));
      setLocalError(null);
    } catch {
      setLocalError("Enter a valid dollar amount (e.g. 12.50).");
    }
  }

  const shownError = error ?? localError;

  return (
    <div className="space-y-1.5" data-testid="currency-field">
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
      <div className="relative">
        <span
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-text-muted"
          aria-hidden
        >
          $
        </span>
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          required={required}
          className="pl-7"
          value={display}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={shownError ? `${id}-error` : undefined}
          onChange={(event) => {
            setDisplay(event.target.value);
            setLocalError(null);
          }}
          onBlur={() => commit(display)}
        />
      </div>
      <input type="hidden" name={name} value={String(cents)} />
      {shownError ? (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {shownError}
        </p>
      ) : null}
    </div>
  );
}

export function formatCurrencyDisplay(cents: Cents | number): string {
  return formatUsdFromCents(cents as Cents);
}
