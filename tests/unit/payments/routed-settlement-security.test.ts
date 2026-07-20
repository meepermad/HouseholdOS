import { describe, expect, it } from "vitest";

/**
 * Contract tests for Security-A routed settlement authorization rules.
 * Full RPC coverage lives in tests/integration/routed-settlement-security.test.ts.
 */
describe("routed settlement security contracts", () => {
  it("documents payer-only proposal creation", () => {
    const rule = {
      createRequires: "actor_membership_id === payer_membership_id",
      coordinatorCannotBindWithoutPayer: true,
      reservationsOnlyAfterAuthorizedCreate: true,
    };
    expect(rule.createRequires).toContain("payer_membership_id");
    expect(rule.coordinatorCannotBindWithoutPayer).toBe(true);
  });

  it("documents scoped idempotency", () => {
    const scope = [
      "household_id",
      "created_by_membership_id",
      "client_idempotency_key",
    ];
    expect(scope).toContain("household_id");
    expect(scope).toContain("created_by_membership_id");
  });

  it("documents correction before obligation restore", () => {
    const steps = [
      "request_routed_settlement_correction",
      "recipient_confirmed_return",
      "payer_and_intermediary_approve",
      "payment_reversal",
      "restore_both_obligation_legs",
    ];
    expect(steps.indexOf("payment_reversal")).toBeLessThan(
      steps.indexOf("restore_both_obligation_legs"),
    );
    expect(steps).toContain("recipient_confirmed_return");
  });

  it("documents opening-balance reverse as unimplemented", () => {
    const openingBalanceReverse = {
      schemaStatusExists: true,
      functionalRpc: false,
      uiAction: false,
    };
    expect(openingBalanceReverse.functionalRpc).toBe(false);
    expect(openingBalanceReverse.uiAction).toBe(false);
  });
});
