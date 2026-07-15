export type {
  ChannelSendResult,
  NotificationChannelAdapter,
  PushSendInput,
} from "@/lib/notifications/adapters/types";

export {
  createWebPushAdapter,
  FakeWebPushAdapter,
} from "@/lib/notifications/adapters/web-push";

export {
  createEmailAdapter,
  type EmailAdapterEnv,
} from "@/lib/notifications/adapters/email";

export { createInAppAdapter } from "@/lib/notifications/adapters/in-app";
