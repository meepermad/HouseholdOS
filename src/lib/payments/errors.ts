import { AppError } from "@/lib/errors";

/** Extract blocking submitted payment UUID from expense-correction RPC errors. */
export function extractBlockingPaymentId(
  message: string | undefined | null,
): string | null {
  const match = (message ?? "").match(
    /submitted payment\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );
  return match?.[1] ?? null;
}

/** Map payment RPC / PostgREST errors to safe user-facing messages. */
export function mapPaymentError(message: string | undefined | null): AppError {
  const m = (message ?? "").toLowerCase();

  if (m.includes("not authenticated")) {
    return new AppError("authentication", "You must sign in first.");
  }
  if (m.includes("invalid payment amount")) {
    return new AppError("validation", "Enter a valid payment amount.");
  }
  if (m.includes("no obligations selected")) {
    return new AppError("validation", "Select at least one obligation to settle.");
  }
  if (m.includes("allocation sum mismatch")) {
    return new AppError(
      "validation",
      "Allocation amounts must add up exactly to the payment total.",
    );
  }
  if (m.includes("allocation exceeds outstanding")) {
    return new AppError(
      "conflict",
      "An allocation exceeds the current outstanding balance.",
    );
  }
  if (m.includes("invalid recipient") || m.includes("cross-household")) {
    return new AppError("validation", "Choose a valid recipient in this household.");
  }
  if (m.includes("only the debtor")) {
    return new AppError(
      "authorization",
      "Only the member who owes this balance can record a payment.",
    );
  }
  if (m.includes("unauthorized confirmation")) {
    return new AppError(
      "authorization",
      "Only the payment recipient can confirm or reject receipt.",
    );
  }
  if (m.includes("only the sender may cancel")) {
    return new AppError(
      "authorization",
      "Only the sender can cancel a submitted payment.",
    );
  }
  if (m.includes("payment already reversed")) {
    return new AppError("conflict", "This payment has already been reversed.");
  }
  if (m.includes("payment already")) {
    return new AppError(
      "conflict",
      "This payment has already been processed and cannot be changed that way.",
    );
  }
  if (m.includes("confirmation conflict") || m.includes("obligation changed")) {
    return new AppError(
      "conflict",
      "Balances changed since you reviewed this payment. Review allocations and try again.",
    );
  }
  if (m.includes("expense correction conflict")) {
    const paymentMatch = (message ?? "").match(
      /submitted payment\s+([0-9a-f-]{36})/i,
    );
    if (paymentMatch?.[1]) {
      return new AppError(
        "conflict",
        `A submitted payment is awaiting action. Open payment ${paymentMatch[1]} to confirm, reject, or cancel it before amending or voiding this expense.`,
      );
    }
    return new AppError(
      "conflict",
      "Cancel or resolve submitted payments before amending or voiding this expense.",
    );
  }
  if (m.includes("invalid waiver")) {
    return new AppError(
      "validation",
      "Waiver amount must be positive and within the official outstanding balance.",
    );
  }
  if (m.includes("debtor cannot waive") || m.includes("only the creditor may waive")) {
    return new AppError(
      "authorization",
      "Only the creditor can waive an outstanding obligation.",
    );
  }
  if (m.includes("dispute conflict")) {
    return new AppError(
      "conflict",
      "This dispute cannot be updated in its current state.",
    );
  }
  if (m.includes("currency")) {
    return new AppError("validation", "Payment currency must match the household.");
  }
  if (m.includes("idempotency")) {
    return new AppError("validation", "A secure idempotency key is required.");
  }

  return new AppError(
    "database_failure",
    "This payment action could not be completed. Please try again.",
  );
}
