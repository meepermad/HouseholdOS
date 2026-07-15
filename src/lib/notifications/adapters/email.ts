import type {
  ChannelSendResult,
  NotificationChannelAdapter,
} from "@/lib/notifications/adapters/types";

export type EmailAdapterEnv = {
  EMAIL_NOTIFICATIONS_ENABLED?: boolean;
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_PROVIDER?: string;
};

/**
 * Phase 3.1 email channel stub. Never calls a provider API until an SDK is wired.
 * Fully configured credentials still return not_configured (stub for this phase).
 */
export function createEmailAdapter(env: EmailAdapterEnv): NotificationChannelAdapter {
  const fullyConfigured =
    env.EMAIL_NOTIFICATIONS_ENABLED === true &&
    Boolean(env.EMAIL_API_KEY?.trim()) &&
    Boolean(env.EMAIL_FROM?.trim());

  // No email SDK in this phase — stay disabled even when env looks complete.
  void fullyConfigured;

  return {
    channel: "email",
    enabled: false,
    async send(input: unknown): Promise<ChannelSendResult> {
      void input;
      return {
        ok: false,
        permanent: true,
        failureCode: "email_not_configured",
        failureCategory: "email_not_configured",
        sanitizedMessage: "Email notifications are not configured for this phase",
      };
    },
  };
}
