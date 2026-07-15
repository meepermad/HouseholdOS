import type {
  ChannelSendResult,
  NotificationChannelAdapter,
} from "@/lib/notifications/adapters/types";

/**
 * In-app rows are written at emit time. This adapter is a no-op success path
 * for any stray claimed in_app deliveries.
 */
export function createInAppAdapter(): NotificationChannelAdapter {
  return {
    channel: "in_app",
    enabled: true,
    async send(input: unknown): Promise<ChannelSendResult> {
      void input;
      return { ok: true };
    },
  };
}
