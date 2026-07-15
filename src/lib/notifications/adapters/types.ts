export type PushSendInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  payload: { title: string; body: string; url: string; tag?: string };
};

export type ChannelSendResult =
  | { ok: true; providerMessageId?: string }
  | {
      ok: false;
      permanent: boolean;
      statusCode?: number;
      failureCode: string;
      failureCategory: string;
      sanitizedMessage: string;
    };

export interface NotificationChannelAdapter {
  readonly channel: "web_push" | "email" | "in_app";
  readonly enabled: boolean;
  send(input: unknown): Promise<ChannelSendResult>;
}
