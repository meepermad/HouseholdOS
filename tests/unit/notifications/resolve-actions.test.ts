import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveActionNotifications } from "@/lib/notifications/resolve-actions";

const rpc = vi.fn();
const createClient = vi.fn(async () => ({ rpc }));
const logServerError = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClient(),
}));

vi.mock("@/lib/errors", () => ({
  logServerError: (...args: unknown[]) => logServerError(...args),
}));

describe("resolveActionNotifications", () => {
  beforeEach(() => {
    rpc.mockReset();
    logServerError.mockReset();
    rpc.mockResolvedValue({ data: 1, error: null });
  });

  it("clears needs-action rows for the completed entity", async () => {
    await resolveActionNotifications("payment", "p-1");
    expect(rpc).toHaveBeenCalledWith("resolve_action_notifications", {
      p_entity_type: "payment",
      p_entity_id: "p-1",
    });
    expect(logServerError).not.toHaveBeenCalled();
  });

  it("logs but does not throw when the RPC returns an error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "nope" } });
    await expect(
      resolveActionNotifications("reimbursement_dispute", "d-1"),
    ).resolves.toBeUndefined();
    expect(logServerError).toHaveBeenCalled();
  });

  it("swallows thrown errors so the committed mutation still succeeds", async () => {
    rpc.mockRejectedValue(new Error("connection reset"));
    await expect(
      resolveActionNotifications("chore_occurrence", "c-1"),
    ).resolves.toBeUndefined();
    expect(logServerError).toHaveBeenCalled();
  });
});
