import { describe, expect, it } from "vitest";
import {
  extractBlockingPaymentId,
  mapPaymentError,
} from "@/lib/payments/errors";

describe("payment error mapping", () => {
  it("extracts blocking payment id and maps a clear conflict message", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    const raw = `Expense correction conflict: submitted payment ${id} awaiting action`;
    expect(extractBlockingPaymentId(raw)).toBe(id);
    expect(mapPaymentError(raw).publicMessage).toContain(id);
    expect(mapPaymentError(raw).publicMessage.toLowerCase()).not.toContain(
      "sqlstate",
    );
  });

  it("never echoes raw database failure details", () => {
    const msg = mapPaymentError(
      'duplicate key value violates unique constraint "payments_pkey"',
    ).publicMessage;
    expect(msg.toLowerCase()).not.toContain("duplicate key");
    expect(msg.toLowerCase()).not.toContain("pkey");
  });
});
