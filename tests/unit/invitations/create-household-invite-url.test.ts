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
      if (name === "create_registration_invitation") {
        return { data: inviteId, error: null };
      }
      if (name === "record_registration_invitation_delivery") {
        return { data: null, error: null };
      }
      throw new Error(`unexpected rpc ${name}`);
    }),
    from: vi.fn((table: string) => {
      if (table === "registration_invitations") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: inviteId,
                    invited_email: "indie@example.com",
                    status: "pending",
                    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
                    purpose: "create_household",
                    household_id: null,
                    intended_roles: [],
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

describe("create-household registration URL + delivery", () => {
  beforeEach(() => {
    deliverInvitation.mockReset();
  });

  it("uses canonical production origin for registration links", async () => {
    deliverInvitation.mockResolvedValue({
      delivered: true,
      channel: "supabase_auth_invite",
      deliveryStatus: "sent",
      result: { outcome: "sent" },
    });

    const inviteId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const { createCreateHouseholdRegistrationOrchestrated } = await import(
      "@/lib/invitations/create-household-orchestration"
    );

    const result = await createCreateHouseholdRegistrationOrchestrated({
      supabase: makeSupabase(inviteId) as never,
      email: "indie@example.com",
    });

    expect(result.inviteUrl).toMatch(
      /^https:\/\/household-os-five\.vercel\.app\/register\/create-household\/[a-f0-9]{64}$/,
    );
    expect(result.purpose).toBe("create_household");
    expect(deliverInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        inviteUrl: result.inviteUrl,
        toEmail: "indie@example.com",
      }),
    );
  });

  it("preserves copyable link when email delivery fails", async () => {
    deliverInvitation.mockResolvedValue({
      delivered: false,
      channel: "supabase_auth_invite",
      deliveryStatus: "failed",
      result: {
        outcome: "failed",
        category: "delivery_failed",
        diagnostic: "provider_error",
      },
    });

    const inviteId = "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const { createCreateHouseholdRegistrationOrchestrated } = await import(
      "@/lib/invitations/create-household-orchestration"
    );

    const result = await createCreateHouseholdRegistrationOrchestrated({
      supabase: makeSupabase(inviteId) as never,
      email: "indie@example.com",
    });

    expect(result.inviteUrl).toContain(
      "https://household-os-five.vercel.app/register/create-household/",
    );
    expect(result.deliveryStatus).toBe("failed");
    expect(result.warning).toBeTruthy();
  });
});
