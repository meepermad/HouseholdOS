import { describe, expect, it } from "vitest";
import {
  FakeWebPushAdapter,
  createWebPushAdapter,
} from "@/lib/notifications/adapters/web-push";
import { classifyPushError } from "@/lib/notifications/retry";

const sampleInput = {
  endpoint: "https://push.example/endpoint",
  p256dh: "pk",
  auth: "ak",
  payload: {
    title: "Hello",
    body: "World",
    url: "/app",
  },
};

describe("web push adapter", () => {
  it("FakeWebPushAdapter records successful sends", async () => {
    const adapter = new FakeWebPushAdapter();
    const result = await adapter.send(sampleInput);
    expect(result).toEqual({ ok: true, providerMessageId: "fake-web-push" });
    expect(adapter.sent).toHaveLength(1);
    expect(adapter.sent[0]?.payload.title).toBe("Hello");
  });

  it("disabled fake adapter rejects without recording", async () => {
    const adapter = new FakeWebPushAdapter({ enabled: false });
    const result = await adapter.send(sampleInput);
    expect(result).toMatchObject({
      ok: false,
      failureCode: "push_disabled",
      permanent: true,
    });
    expect(adapter.sent).toHaveLength(0);
  });

  it("createWebPushAdapter is disabled without VAPID configuration", async () => {
    const adapter = createWebPushAdapter({
      publicKey: undefined,
      privateKey: undefined,
      subject: undefined,
      enabled: true,
    });
    expect(adapter.enabled).toBe(false);
    const result = await adapter.send(sampleInput);
    expect(result).toMatchObject({
      ok: false,
      failureCode: "push_disabled",
    });
  });

  it("routes recorded failures with push error classification categories", async () => {
    const classification = classifyPushError(410);
    expect(classification.category).toBe("subscription_gone");
    const adapter = new FakeWebPushAdapter({
      failWith: {
        ok: false,
        permanent: classification.kind === "permanent",
        statusCode: 410,
        failureCode: classification.code,
        failureCategory: classification.category,
        sanitizedMessage: "subscription gone",
      },
    });
    const result = await adapter.send(sampleInput);
    expect(result).toMatchObject({
      ok: false,
      permanent: true,
      failureCategory: "subscription_gone",
    });
    expect(adapter.sent).toHaveLength(1);
  });
});
