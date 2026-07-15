import webpush, { WebPushError } from "web-push";
import { classifyPushError } from "@/lib/notifications/retry";
import type {
  ChannelSendResult,
  NotificationChannelAdapter,
  PushSendInput,
} from "@/lib/notifications/adapters/types";

function isPushSendInput(input: unknown): input is PushSendInput {
  if (!input || typeof input !== "object") return false;
  const o = input as Record<string, unknown>;
  const payload = o.payload;
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof o.endpoint === "string" &&
    typeof o.p256dh === "string" &&
    typeof o.auth === "string" &&
    typeof p.title === "string" &&
    typeof p.body === "string" &&
    typeof p.url === "string"
  );
}

/** Never include endpoints or keys in worker-facing error text. */
function sanitizePushMessage(message: string): string {
  return message
    .replace(/https?:\/\/\S+/gi, "[redacted]")
    .replace(/endpoint[=:]\S+/gi, "endpoint=[redacted]")
    .replace(/p256dh[=:]\S+/gi, "p256dh=[redacted]")
    .replace(/auth[=:]\S+/gi, "auth=[redacted]")
    .slice(0, 200);
}

export function createWebPushAdapter(opts: {
  publicKey: string | undefined;
  privateKey: string | undefined;
  subject: string | undefined;
  enabled: boolean;
}): NotificationChannelAdapter {
  const configured =
    opts.enabled &&
    Boolean(opts.publicKey?.trim()) &&
    Boolean(opts.privateKey?.trim()) &&
    Boolean(opts.subject?.trim());

  return {
    channel: "web_push",
    enabled: configured,
    async send(input: unknown): Promise<ChannelSendResult> {
      if (!configured) {
        return {
          ok: false,
          permanent: true,
          failureCode: "push_disabled",
          failureCategory: "push_disabled",
          sanitizedMessage: "Web push delivery is disabled or missing VAPID keys",
        };
      }

      if (!isPushSendInput(input)) {
        return {
          ok: false,
          permanent: true,
          failureCode: "invalid_push_input",
          failureCategory: "invalid_input",
          sanitizedMessage: "Invalid web push send input",
        };
      }

      webpush.setVapidDetails(
        opts.subject!.trim(),
        opts.publicKey!.trim(),
        opts.privateKey!.trim(),
      );

      try {
        const result = await webpush.sendNotification(
          {
            endpoint: input.endpoint,
            keys: {
              p256dh: input.p256dh,
              auth: input.auth,
            },
          },
          JSON.stringify(input.payload),
        );
        return {
          ok: true,
          providerMessageId:
            typeof result?.statusCode === "number"
              ? String(result.statusCode)
              : undefined,
        };
      } catch (err) {
        if (err instanceof WebPushError) {
          const classification = classifyPushError(err.statusCode, err.message);
          return {
            ok: false,
            permanent: classification.kind === "permanent",
            statusCode: err.statusCode,
            failureCode: classification.code,
            failureCategory: classification.category,
            sanitizedMessage: sanitizePushMessage(err.message),
          };
        }

        const message = err instanceof Error ? err.message : "push_send_failed";
        const classification = classifyPushError(null, message);
        return {
          ok: false,
          permanent: classification.kind === "permanent",
          failureCode: classification.code,
          failureCategory: classification.category,
          sanitizedMessage: sanitizePushMessage(message),
        };
      }
    },
  };
}

export class FakeWebPushAdapter implements NotificationChannelAdapter {
  readonly channel = "web_push" as const;
  readonly enabled: boolean;
  readonly sent: PushSendInput[] = [];
  private failWith: ChannelSendResult | null;

  constructor(opts?: {
    enabled?: boolean;
    failWith?: ChannelSendResult & { ok: false };
  }) {
    this.enabled = opts?.enabled ?? true;
    this.failWith = opts?.failWith ?? null;
  }

  /** Configure the next send(s) to fail until cleared. */
  setFailWith(result: (ChannelSendResult & { ok: false }) | null): void {
    this.failWith = result;
  }

  async send(input: unknown): Promise<ChannelSendResult> {
    if (!this.enabled) {
      return {
        ok: false,
        permanent: true,
        failureCode: "push_disabled",
        failureCategory: "push_disabled",
        sanitizedMessage: "Fake web push adapter disabled",
      };
    }

    if (!isPushSendInput(input)) {
      return {
        ok: false,
        permanent: true,
        failureCode: "invalid_push_input",
        failureCategory: "invalid_input",
        sanitizedMessage: "Invalid web push send input",
      };
    }

    this.sent.push(input);

    if (this.failWith) {
      return this.failWith;
    }

    return { ok: true, providerMessageId: "fake-web-push" };
  }
}
