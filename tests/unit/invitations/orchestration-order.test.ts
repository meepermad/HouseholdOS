import { beforeEach, describe, expect, it, vi } from "vitest";

const deliverInvitation = vi.fn();
const getServerEnv = vi.fn(() => ({
  APP_URL: "https://app.example.test",
  INVITATION_TTL_HOURS: 168,
}));

vi.mock("@/lib/invitations/delivery", () => ({
  deliverInvitation: (...args: unknown[]) => deliverInvitation(...args),
}));

vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => getServerEnv(),
}));

vi.mock("@/lib/env/canonical-origin", () => ({
  getCanonicalAppOrigin: () => "https://app.example.test",
  buildInvitationJoinUrl: (token: string, origin = "https://app.example.test") =>
    new URL(`/join/${token}`, origin).toString(),
  buildAppAbsoluteUrl: (path: string, origin = "https://app.example.test") =>
    new URL(path.startsWith("/") ? path : `/${path}`, origin).toString(),
}));

describe("invitation orchestration order", () => {
  beforeEach(() => {
    deliverInvitation.mockReset();
    deliverInvitation.mockResolvedValue({
      delivered: true,
      channel: "supabase_auth_invite",
      deliveryStatus: "sent",
      result: { outcome: "sent" },
    });
  });

  it("commits pending app invitation before Auth Admin invite", async () => {
    const order: string[] = [];
    const inviteId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

    const supabase = {
      rpc: vi.fn(async (name: string) => {
        if (name === "create_household_invitation") {
          order.push("create_household_invitation");
          return { data: inviteId, error: null };
        }
        if (name === "record_invitation_delivery") {
          order.push("record_invitation_delivery");
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
                  maybeSingle: async () => {
                    order.push("confirm_pending_row");
                    return {
                      data: {
                        id: inviteId,
                        invited_email: "roommate@example.com",
                        status: "pending",
                        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
                        intended_roles: ["member"],
                        household_id: "hhhhhhhh-hhhh-4hhh-8hhh-hhhhhhhhhhhh",
                      },
                      error: null,
                    };
                  },
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

    deliverInvitation.mockImplementation(async () => {
      order.push("auth_admin_invite");
      return {
        delivered: true,
        channel: "supabase_auth_invite",
        deliveryStatus: "sent",
        result: { outcome: "sent" },
      };
    });

    const { createHouseholdInvitationOrchestrated } = await import(
      "@/lib/invitations/orchestration"
    );

    const result = await createHouseholdInvitationOrchestrated({
      supabase: supabase as never,
      householdId: "hhhhhhhh-hhhh-4hhh-8hhh-hhhhhhhhhhhh",
      email: "  Roommate@Example.com ",
      intendedRoles: ["member"],
    });

    expect(order).toEqual([
      "create_household_invitation",
      "confirm_pending_row",
      "auth_admin_invite",
      "record_invitation_delivery",
    ]);
    expect(result.invitedEmail).toBe("roommate@example.com");
    expect(result.inviteUrl).toMatch(/^https:\/\/app\.example\.test\/join\//);
    expect(result.inviteUrl).not.toContain("token_hash");
    expect(result.deliveryStatus).toBe("sent");
  });

  it("preserves app invitation and returns join link when Auth email fails", async () => {
    const inviteId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const supabase = {
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
      }),
    };

    deliverInvitation.mockResolvedValue({
      delivered: false,
      channel: "supabase_auth_invite",
      deliveryStatus: "failed",
      result: {
        outcome: "failed",
        category: "delivery_failed",
        diagnostic:
          "The household invitation was created, but the email could not be delivered.",
      },
    });

    const { createHouseholdInvitationOrchestrated } = await import(
      "@/lib/invitations/orchestration"
    );

    const result = await createHouseholdInvitationOrchestrated({
      supabase: supabase as never,
      householdId: "hhhhhhhh-hhhh-4hhh-8hhh-hhhhhhhhhhhh",
      email: "roommate@example.com",
      intendedRoles: ["member"],
    });

    expect(result.inviteUrl).toContain("/join/");
    expect(result.deliveryStatus).toBe("failed");
    expect(result.message.toLowerCase()).toContain("could not be sent");
    expect(result.message.toLowerCase()).not.toContain("failed to invite user");
    expect(supabase.rpc).toHaveBeenCalledWith(
      "record_invitation_delivery",
      expect.objectContaining({
        p_delivery_status: "failed",
        p_error_category: "delivery_failed",
      }),
    );
  });

  it("returns join link for existing Auth users without failing the app invite", async () => {
    const inviteId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const supabase = {
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
                      invited_email: "existing@example.com",
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
      }),
    };

    deliverInvitation.mockResolvedValue({
      delivered: false,
      channel: "supabase_auth_invite",
      deliveryStatus: "existing_account",
      result: { outcome: "existing_account" },
    });

    const { createHouseholdInvitationOrchestrated } = await import(
      "@/lib/invitations/orchestration"
    );

    const result = await createHouseholdInvitationOrchestrated({
      supabase: supabase as never,
      householdId: "hhhhhhhh-hhhh-4hhh-8hhh-hhhhhhhhhhhh",
      email: "existing@example.com",
      intendedRoles: ["member"],
    });

    expect(result.deliveryStatus).toBe("existing_account");
    expect(result.inviteUrl).toContain("/join/");
    expect(result.message).toContain("already have an account");
  });
});
