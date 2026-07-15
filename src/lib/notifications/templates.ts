import {
  getCatalogEntry,
  type NotificationCategory,
} from "@/lib/notifications/catalog";

export type PrivacyPreview = "generic" | "detailed";

export type PushContent = {
  title: string;
  body: string;
};

export const MAX_PUSH_PAYLOAD_BYTES = 3500;

export const TEST_NOTIFICATION_TEMPLATE: PushContent = {
  title: "HouseholdOS test notification",
  body: "Push delivery is working. No account details were included.",
};

const GENERIC_BY_CATEGORY: Record<
  NotificationCategory,
  PushContent
> = {
  payments: {
    title: "Payment update in HouseholdOS",
    body: "Open HouseholdOS to review it.",
  },
  disputes: {
    title: "Dispute update in HouseholdOS",
    body: "Open HouseholdOS to review it.",
  },
  expenses: {
    title: "Expense update in HouseholdOS",
    body: "Open HouseholdOS to review it.",
  },
  reimbursements: {
    title: "Reimbursement update in HouseholdOS",
    body: "Open HouseholdOS to review it.",
  },
  membership: {
    title: "Household update in HouseholdOS",
    body: "Open HouseholdOS to review it.",
  },
  chores: {
    title: "Chore update in HouseholdOS",
    body: "Open HouseholdOS to review it.",
  },
  calendar: {
    title: "Calendar update in HouseholdOS",
    body: "Open HouseholdOS to review it.",
  },
  inventory: {
    title: "Inventory update in HouseholdOS",
    body: "Open HouseholdOS to review it.",
  },
  shopping: {
    title: "Shopping update in HouseholdOS",
    body: "Open HouseholdOS to review it.",
  },
  maintenance: {
    title: "Maintenance update in HouseholdOS",
    body: "Open HouseholdOS to review it.",
  },
  approvals: {
    title: "Approval update in HouseholdOS",
    body: "Open HouseholdOS to review it.",
  },
  agreements: {
    title: "Agreement update in HouseholdOS",
    body: "Open HouseholdOS to review it.",
  },
  system: {
    title: "Update in HouseholdOS",
    body: "Open HouseholdOS to review it.",
  },
};

const DETAILED_FALLBACKS: Record<string, (actor: string) => PushContent> = {
  "payment.awaiting_confirmation": (actor) => ({
    title: "Payment awaiting confirmation",
    body: `${actor} recorded a payment for your review.`,
  }),
  "payment.confirmed": (actor) => ({
    title: "Payment confirmed",
    body: `${actor} confirmed your recorded payment.`,
  }),
  "payment.rejected": (actor) => ({
    title: "Payment rejected",
    body: `${actor} rejected a recorded payment.`,
  }),
  "payment.cancelled": (actor) => ({
    title: "Payment cancelled",
    body: `${actor} cancelled a submitted payment.`,
  }),
  "payment.reversed": (actor) => ({
    title: "Payment reversed",
    body: `${actor} reversed a previously confirmed payment.`,
  }),
  "waiver.created": (actor) => ({
    title: "Obligation waived",
    body: `${actor} waived part or all of an obligation.`,
  }),
  "waiver.reversed": (actor) => ({
    title: "Waiver reversed",
    body: `${actor} reversed a previous waiver.`,
  }),
  "dispute.opened": (actor) => ({
    title: "Dispute opened",
    body: `${actor} opened a financial dispute.`,
  }),
  "dispute.resolved": (actor) => ({
    title: "Dispute resolved",
    body: `${actor} resolved a financial dispute.`,
  }),
  "refund_obligation.created": (actor) => ({
    title: "Refund obligation created",
    body: actor === "Someone"
      ? "An expense correction created a refund obligation."
      : `${actor} triggered a refund obligation.`,
  }),
  "expense.voided": (actor) => ({
    title: "Expense voided",
    body: `${actor} voided a confirmed expense.`,
  }),
  "expense.amended": (actor) => ({
    title: "Expense amended",
    body: `${actor} amended a confirmed expense.`,
  }),
  // Calendar fallbacks stay privacy-safe: never include the event title,
  // description, location, or guest details in push copy.
  "calendar.event_created": (actor) => ({
    title: "New calendar event",
    body: actor === "Someone"
      ? "A new event was added to the household calendar."
      : `${actor} added a household calendar event.`,
  }),
  "calendar.event_updated": (actor) => ({
    title: "Calendar event updated",
    body: actor === "Someone"
      ? "A household calendar event was updated."
      : `${actor} updated a household calendar event.`,
  }),
  "calendar.event_cancelled": (actor) => ({
    title: "Calendar event cancelled",
    body: actor === "Someone"
      ? "A household calendar event was cancelled."
      : `${actor} cancelled a household calendar event.`,
  }),
  "calendar.rsvp_changed": (actor) => ({
    title: "RSVP updated",
    body: actor === "Someone"
      ? "An attendee updated their RSVP for a calendar event."
      : `${actor} updated their RSVP for a calendar event.`,
  }),
  "calendar.reminder": () => ({
    title: "Upcoming household event",
    body: "Open HouseholdOS to review it.",
  }),
};

/** Strip amounts, refs, tokens, and bank-like fragments from display text. */
export function stripSensitive(text: string): string {
  return text
    .replace(/\$[\d,]+(?:\.\d{1,2})?/g, "")
    .replace(/\b\d+\s*(?:USD|cents?|dollars?)\b/gi, "")
    .replace(/\b(?:amount|total)[_ ]?cents?\b\s*[:=]?\s*\d+/gi, "")
    .replace(/\b(?:token|invite|password|secret)\s*[:=]\s*\S+/gi, "")
    .replace(/\b(?:venmo|zelle|paypal|ach|routing|account)\b[^.,;]{0,40}/gi, "")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function buildPushContent(
  eventType: string,
  opts: {
    privacyPreview: PrivacyPreview;
    actorDisplayName?: string;
  },
): PushContent {
  const catalog = getCatalogEntry(eventType);
  const category = catalog?.category ?? "system";
  const generic = GENERIC_BY_CATEGORY[category];

  if (opts.privacyPreview === "generic" || catalog?.privacy === "routing_only") {
    return { ...generic };
  }

  const actor = stripSensitive(
    (opts.actorDisplayName?.trim() || "Someone").slice(0, 64),
  );
  const builder = DETAILED_FALLBACKS[eventType];
  if (builder) {
    const detailed = builder(actor || "Someone");
    return {
      title: stripSensitive(detailed.title),
      body: stripSensitive(detailed.body),
    };
  }

  return {
    title: stripSensitive(generic.title),
    body: stripSensitive(
      actor && actor !== "Someone"
        ? `${actor} posted an update. Open HouseholdOS to review it.`
        : generic.body,
    ),
  };
}

export function validatePushPayloadSize(payload: object): boolean {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json).byteLength;
  return bytes <= MAX_PUSH_PAYLOAD_BYTES;
}
