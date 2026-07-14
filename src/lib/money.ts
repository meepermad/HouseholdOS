/** Integer-cent money helpers. Never use floating-point for financial math. */

export type Cents = number & { readonly __brand: "Cents" };

export function toCents(amount: number): Cents {
  if (!Number.isInteger(amount)) {
    throw new Error("Amount must be an integer number of cents");
  }
  return amount as Cents;
}

export function addCents(a: Cents, b: Cents): Cents {
  return toCents(a + b);
}

export function subtractCents(a: Cents, b: Cents): Cents {
  return toCents(a - b);
}

/** Split a total into n equal shares; remainder cents go to the first shares. */
export function splitCentsEvenly(total: Cents, parts: number): Cents[] {
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new Error("parts must be a positive integer");
  }
  const base = Math.trunc(total / parts);
  const remainder = total - base * parts;
  return Array.from({ length: parts }, (_, i) =>
    toCents(base + (i < remainder ? 1 : 0)),
  );
}

export function sumCents(values: readonly Cents[]): Cents {
  return toCents(values.reduce((acc, v) => acc + v, 0));
}

export function formatUsdFromCents(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.trunc(abs / 100);
  const rem = abs % 100;
  return `${sign}$${dollars}.${rem.toString().padStart(2, "0")}`;
}

export function parseUsdToCents(input: string): Cents {
  const trimmed = input.trim().replace(/\$/g, "").replace(/,/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error("Invalid USD amount");
  }
  const negative = trimmed.startsWith("-");
  const [whole, frac = ""] = trimmed.replace("-", "").split(".");
  const cents = Number.parseInt(whole, 10) * 100 + Number.parseInt(frac.padEnd(2, "0"), 10);
  return toCents(negative ? -cents : cents);
}
