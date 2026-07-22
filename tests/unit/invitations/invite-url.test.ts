import { beforeEach, describe, expect, it, vi } from "vitest";

const deliverInvitation = vi.fn();
const getServerEnv = vi.fn(() => ({
  APP_URL: "https://household-os-five.vercel.app",
  INVITATION_TTL_HOURS: 168,
}));

vi.mock("@/lib/invitations/delivery", () => ({
  deliverInvitation: (...args: unknown[]) => deliverInvitation(...args),
}));

vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => getServerEnv(),
}));

vi.mock("@/lib/env/canonical-origin", async () => {
  const actual = await vi.importActual<typeof import("@/lib/env/canonical-origin")>(
    "@/lib/env/canonical-origin",
  );
  return {
    ...actual,
    getCanonicalAppOrigin: () => "https://household-os-five.vercel.app",
  };
});

function makeSupabase(inviteId: string) {
  return {
    rpc: vi.fn(async (name: string) => {
      if (name === "create_household_invitation") {
        return { data: inviteId, error: null };
      }
      if (name === "record_invitation_delivery") {
        return { data: null, error: null };
      }
      throw new Error(`unexpected rpc ${name}`);
    }),
    from: vi.fn((table: string) => {
      if (table === "household_invitations") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: inviteId,
                    invited_email: "roommate@example.com",
                    status: "pending",
                    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
                    intended_roles: ["member"],
                    household_id: "hhhhhhhh-hhhh-4hhh-8hhh-hhhhhhhhhhhh",
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "households") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { name: "Test House" },
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

describe("invitation join URL + Supabase redirectTo", () => {
  beforeEach(() => {
    deliverInvitation.mockReset();
    deliverInvitation.mockResolvedValue({
      delivered: true,
      channel: "supabase_auth_invite",
      deliveryStatus: "sent",
      result: { outcome: "sent" },
    });
  });

  it("builds HTTPS production invite links and uses the same URL for redirectTo", async () => {
    const inviteId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const { createHouseholdInvitationOrchestrated } = await import(
      "@/lib/invitations/orchestration"
    );

    const result = await createHouseholdInvitationOrchestrated({
      supabase: makeSupabase(inviteId) as never,
      householdId: "hhhhhhhh-hhhh-4hhh-8hhh-hhhhhhhhhhhh",
      email: "roommate@example.com",
      intendedRoles: ["member"],
    });

    expect(result.inviteUrl).toMatch(
      /^https:\/\/household-os-five\.vercel\.app\/join\/[A-Za-z0-9_-]+$/,
    );
    expect(result.inviteUrl).not.toMatch(/localhost/i);
    expect(deliverInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        inviteUrl: result.inviteUrl,
      }),
    );
  });

  it("does not log the raw invitation token", async () => {
    const inviteId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { createHouseholdInvitationOrchestrated } = await import(
      "@/lib/invitations/orchestration"
    );

    const result = await createHouseholdInvitationOrchestrated({
      supabase: makeSupabase(inviteId) as never,
      householdId: "hhhhhhhh-hhhh-4hhh-8hhh-hhhhhhhhhhhh",
      email: "roommate@example.com",
      intendedRoles: ["member"],
    });

    const token = result.inviteUrl.split("/join/")[1]!;
    expect(token.length).toBeGreaterThanOrEqual(32);

    for (const spy of [errorSpy, logSpy, infoSpy, warnSpy]) {
      for (const call of spy.mock.calls) {
        const serialized = call.map((arg) => String(arg)).join(" ");
        expect(serialized).not.toContain(token);
      }
    }

    errorSpy.mockRestore();
    logSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
