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
  allowNegative = false,
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
  /** Allow negative amounts (discounts, credits). */
  allowNegative?: boolean;
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
      if (parsed < 0 && !allowNegative) {
        setLocalError("Amount cannot be negative.");
        return;
      }
      if (Math.abs(parsed) > maxCents) {
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

/**
 * Controlled dollar input for amounts held in component state rather than
 * submitted directly (per-member allocations, for example).
 */
export function CurrencyAmountInput({
  valueCents,
  onChangeCents,
  ariaLabel,
  placeholder = "0.00",
  allowNegative = false,
  className,
}: {
  valueCents: number | undefined;
  onChangeCents: (cents: number | undefined) => void;
  ariaLabel: string;
  placeholder?: string;
  allowNegative?: boolean;
  className?: string;
}) {
  const [display, setDisplay] = useState(centsToInputValue(valueCents));

  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-text-muted"
        aria-hidden
      >
        $
      </span>
      <input
        inputMode="decimal"
        autoComplete="off"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={display}
        className={
          className ??
          "w-full rounded-md border border-line bg-input-bg py-1 pl-7 pr-2 text-sm"
        }
        onChange={(event) => {
          const raw = event.target.value;
          setDisplay(raw);
          const trimmed = raw.trim();
          if (!trimmed) {
            onChangeCents(undefined);
            return;
          }
          try {
            const parsed = parseUsdToCents(trimmed);
            if (parsed < 0 && !allowNegative) return;
            onChangeCents(parsed);
          } catch {
            // Keep the raw text while the member is still typing.
          }
        }}
        onBlur={() => setDisplay(centsToInputValue(valueCents))}
      />
    </div>
  );
}

export function formatCurrencyDisplay(cents: Cents | number): string {
  return formatUsdFromCents(cents as Cents);
}
