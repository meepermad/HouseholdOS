/**
 * Domain-neutral notification event catalog.
 * Active eventType strings match Phase 3 SQL emitters exactly.
 */

export type NotificationCategory =
  | "payments"
  | "disputes"
  | "expenses"
  | "reimbursements"
  | "membership"
  | "chores"
  | "calendar"
  | "inventory"
  | "shopping"
  | "maintenance"
  | "approvals"
  | "agreements"
  | "system";

export type NotificationUrgency = "low" | "normal" | "high" | "urgent";
export type NotificationChannel = "in_app" | "push" | "email";
export type DeliveryMode = "immediate" | "daily_digest" | "off";
export type PrivacyClass = "routing_only" | "generic_ok" | "detailed_ok";
export type RecipientRule =
  | "payment_recipient"
  | "payment_sender"
  | "other_party"
  | "debtor"
  | "involved_parties"
  | "other_active_members"
  | "raiser"
  | "actor_excluded"
  | "self"
  | "explicit";

export type CatalogEntry = {
  eventType: string;
  category: NotificationCategory;
  defaultUrgency: NotificationUrgency;
  defaultChannels: NotificationChannel[];
  recipientRule: RecipientRule;
  deepLinkPattern: string;
  digestAllowed: boolean;
  actionOriented: boolean;
  privacy: PrivacyClass;
  active: boolean;
};

// --- Active Phase 3 event types (canonical SQL strings) ---

/** Canonical emit type for payment submit. Conceptual alias: payment.submitted */
export const EVENT_PAYMENT_AWAITING_CONFIRMATION =
  "payment.awaiting_confirmation" as const;
/** Conceptual alias for EVENT_PAYMENT_AWAITING_CONFIRMATION */
export const EVENT_PAYMENT_SUBMITTED = EVENT_PAYMENT_AWAITING_CONFIRMATION;

export const EVENT_PAYMENT_CONFIRMED = "payment.confirmed" as const;
export const EVENT_PAYMENT_REJECTED = "payment.rejected" as const;
export const EVENT_PAYMENT_CANCELLED = "payment.cancelled" as const;
export const EVENT_PAYMENT_REVERSED = "payment.reversed" as const;

/** Canonical notify type. Conceptual alias: reimbursement.waived */
export const EVENT_WAIVER_CREATED = "waiver.created" as const;
export const EVENT_REIMBURSEMENT_WAIVED = EVENT_WAIVER_CREATED;

/** Canonical notify type. Conceptual alias: reimbursement.waiver_reversed */
export const EVENT_WAIVER_REVERSED = "waiver.reversed" as const;
export const EVENT_REIMBURSEMENT_WAIVER_REVERSED = EVENT_WAIVER_REVERSED;

export const EVENT_DISPUTE_OPENED = "dispute.opened" as const;
export const EVENT_DISPUTE_RESOLVED = "dispute.resolved" as const;
export const EVENT_REFUND_OBLIGATION_CREATED =
  "refund_obligation.created" as const;
export const EVENT_EXPENSE_VOIDED = "expense.voided" as const;
export const EVENT_EXPENSE_AMENDED = "expense.amended" as const;

// --- Future reserved (documented; not emitted) ---

export const EVENT_CHORE_ASSIGNED = "chore.assigned" as const;
export const EVENT_CHORE_DUE_SOON = "chore.due_soon" as const;
export const EVENT_CHORE_OVERDUE = "chore.overdue" as const;
export const EVENT_CHORE_COMPLETED = "chore.completed" as const;
export const EVENT_CHORE_REASSIGNED = "chore.reassigned" as const;
/** @deprecated Prefer EVENT_CHORE_DUE_SOON */
export const EVENT_CHORE_DUE = EVENT_CHORE_DUE_SOON;
export const EVENT_CALENDAR_EVENT_CREATED = "calendar.event_created" as const;
export const EVENT_CALENDAR_EVENT_UPDATED = "calendar.event_updated" as const;
export const EVENT_CALENDAR_EVENT_CANCELLED = "calendar.event_cancelled" as const;
export const EVENT_CALENDAR_REMINDER = "calendar.reminder" as const;
export const EVENT_CALENDAR_RSVP_CHANGED = "calendar.rsvp_changed" as const;
export const EVENT_CALENDAR_ATTENDEE_ADDED = "calendar.attendee_added" as const;
/** @deprecated Prefer EVENT_CALENDAR_EVENT_UPDATED */
export const EVENT_CALENDAR_UPDATED = EVENT_CALENDAR_EVENT_UPDATED;
export const EVENT_INVENTORY_LOW = "inventory.low" as const;
export const EVENT_SHOPPING_ITEM_REQUESTED = "shopping.item_requested" as const;
export const EVENT_MAINTENANCE_REPORTED = "maintenance.reported" as const;
export const EVENT_MAINTENANCE_UPDATED = "maintenance.updated" as const;
/** @deprecated Prefer EVENT_MAINTENANCE_REPORTED */
export const EVENT_MAINTENANCE_DUE = EVENT_MAINTENANCE_REPORTED;
/** @deprecated Prefer EVENT_MAINTENANCE_UPDATED */
export const EVENT_MAINTENANCE_COMPLETED = EVENT_MAINTENANCE_UPDATED;
export const EVENT_APPROVAL_REQUESTED = "approval.requested" as const;
export const EVENT_APPROVAL_DECIDED = "approval.decided" as const;
export const EVENT_AGREEMENT_ACKNOWLEDGMENT_REQUIRED =
  "agreement.acknowledgment_required" as const;
/** @deprecated Prefer EVENT_AGREEMENT_ACKNOWLEDGMENT_REQUIRED */
export const EVENT_AGREEMENT_PROPOSED = EVENT_AGREEMENT_ACKNOWLEDGMENT_REQUIRED;
export const EVENT_AGREEMENT_ACCEPTED = "agreement.accepted" as const;
export const EVENT_HOUSEHOLD_INVITATION_CREATED =
  "household.invitation_created" as const;
export const EVENT_HOUSEHOLD_INVITATION_ACCEPTED =
  "household.invitation_accepted" as const;
export const EVENT_HOUSEHOLD_MEMBER_JOINED =
  "household.member_joined" as const;
export const EVENT_PAYMENT_ALLOCATION_CONFLICT =
  "payment.allocation_conflict" as const;
export const EVENT_DISPUTE_UPDATED = "dispute.updated" as const;
export const EVENT_DISPUTE_WITHDRAWN = "dispute.withdrawn" as const;
export const EVENT_EXPENSE_CONFIRMED = "expense.confirmed" as const;
export const EVENT_REIMBURSEMENT_REFUND_CREATED =
  "reimbursement.refund_created" as const;

/** Audit-log conceptual names → notification catalog keys */
export const CONCEPTUAL_EVENT_ALIASES = {
  "payment.submitted": EVENT_PAYMENT_AWAITING_CONFIRMATION,
  "reimbursement.waived": EVENT_WAIVER_CREATED,
  "reimbursement.waiver_reversed": EVENT_WAIVER_REVERSED,
} as const;

const PAYMENT_LINK = "/app/{householdId}/money/payments/{entityId}";
const REIMBURSEMENT_LINK = "/app/{householdId}/money/reimbursements/{entityId}";
const DISPUTE_LINK = "/app/{householdId}/money/disputes/{entityId}";
const EXPENSE_LINK = "/app/{householdId}/money/expenses/{entityId}";
const APP_LINK = "/app/{householdId}";
const CALENDAR_EVENT_LINK = "/app/{householdId}/calendar/events/{entityId}";

function entry(
  partial: Omit<CatalogEntry, "defaultChannels"> & {
    defaultChannels?: NotificationChannel[];
  },
): CatalogEntry {
  return {
    ...partial,
    defaultChannels: partial.defaultChannels ?? ["in_app", "push"],
  };
}

export const NOTIFICATION_CATALOG: Readonly<Record<string, CatalogEntry>> = {
  [EVENT_PAYMENT_AWAITING_CONFIRMATION]: entry({
    eventType: EVENT_PAYMENT_AWAITING_CONFIRMATION,
    category: "payments",
    defaultUrgency: "high",
    recipientRule: "payment_recipient",
    deepLinkPattern: PAYMENT_LINK,
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_PAYMENT_CONFIRMED]: entry({
    eventType: EVENT_PAYMENT_CONFIRMED,
    category: "payments",
    defaultUrgency: "normal",
    recipientRule: "payment_sender",
    deepLinkPattern: PAYMENT_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_PAYMENT_REJECTED]: entry({
    eventType: EVENT_PAYMENT_REJECTED,
    category: "payments",
    defaultUrgency: "high",
    recipientRule: "payment_sender",
    deepLinkPattern: PAYMENT_LINK,
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_PAYMENT_CANCELLED]: entry({
    eventType: EVENT_PAYMENT_CANCELLED,
    category: "payments",
    defaultUrgency: "normal",
    recipientRule: "payment_recipient",
    deepLinkPattern: PAYMENT_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_PAYMENT_REVERSED]: entry({
    eventType: EVENT_PAYMENT_REVERSED,
    category: "payments",
    defaultUrgency: "high",
    recipientRule: "other_party",
    deepLinkPattern: PAYMENT_LINK,
    digestAllowed: false,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_WAIVER_CREATED]: entry({
    eventType: EVENT_WAIVER_CREATED,
    category: "reimbursements",
    defaultUrgency: "normal",
    recipientRule: "debtor",
    deepLinkPattern: REIMBURSEMENT_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_WAIVER_REVERSED]: entry({
    eventType: EVENT_WAIVER_REVERSED,
    category: "reimbursements",
    defaultUrgency: "high",
    recipientRule: "debtor",
    deepLinkPattern: REIMBURSEMENT_LINK,
    digestAllowed: false,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_DISPUTE_OPENED]: entry({
    eventType: EVENT_DISPUTE_OPENED,
    category: "disputes",
    defaultUrgency: "high",
    recipientRule: "other_active_members",
    deepLinkPattern: DISPUTE_LINK,
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_DISPUTE_RESOLVED]: entry({
    eventType: EVENT_DISPUTE_RESOLVED,
    category: "disputes",
    defaultUrgency: "normal",
    recipientRule: "raiser",
    deepLinkPattern: DISPUTE_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_REFUND_OBLIGATION_CREATED]: entry({
    eventType: EVENT_REFUND_OBLIGATION_CREATED,
    category: "reimbursements",
    defaultUrgency: "high",
    recipientRule: "debtor",
    deepLinkPattern: REIMBURSEMENT_LINK,
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_EXPENSE_VOIDED]: entry({
    eventType: EVENT_EXPENSE_VOIDED,
    category: "expenses",
    defaultUrgency: "normal",
    recipientRule: "other_active_members",
    deepLinkPattern: EXPENSE_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_EXPENSE_AMENDED]: entry({
    eventType: EVENT_EXPENSE_AMENDED,
    category: "expenses",
    defaultUrgency: "normal",
    recipientRule: "other_active_members",
    deepLinkPattern: EXPENSE_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),

  // Future reserved
  [EVENT_CHORE_ASSIGNED]: entry({
    eventType: EVENT_CHORE_ASSIGNED,
    category: "chores",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/chores/{entityId}`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "detailed_ok",
    active: false,
  }),
  [EVENT_CHORE_COMPLETED]: entry({
    eventType: EVENT_CHORE_COMPLETED,
    category: "chores",
    defaultUrgency: "low",
    recipientRule: "actor_excluded",
    deepLinkPattern: `${APP_LINK}/chores/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "detailed_ok",
    active: false,
  }),
  [EVENT_CHORE_DUE_SOON]: entry({
    eventType: EVENT_CHORE_DUE_SOON,
    category: "chores",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/chores/{entityId}`,
    digestAllowed: false,
    actionOriented: true,
    privacy: "detailed_ok",
    active: false,
  }),
  [EVENT_CHORE_OVERDUE]: entry({
    eventType: EVENT_CHORE_OVERDUE,
    category: "chores",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/chores/{entityId}`,
    digestAllowed: false,
    actionOriented: true,
    privacy: "detailed_ok",
    active: false,
  }),
  [EVENT_CHORE_REASSIGNED]: entry({
    eventType: EVENT_CHORE_REASSIGNED,
    category: "chores",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/chores/{entityId}`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "detailed_ok",
    active: false,
  }),
  [EVENT_CALENDAR_EVENT_CREATED]: entry({
    eventType: EVENT_CALENDAR_EVENT_CREATED,
    category: "calendar",
    defaultUrgency: "normal",
    recipientRule: "involved_parties",
    deepLinkPattern: CALENDAR_EVENT_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "detailed_ok",
    active: true,
  }),
  [EVENT_CALENDAR_EVENT_UPDATED]: entry({
    eventType: EVENT_CALENDAR_EVENT_UPDATED,
    category: "calendar",
    defaultUrgency: "normal",
    recipientRule: "involved_parties",
    deepLinkPattern: CALENDAR_EVENT_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "detailed_ok",
    active: true,
  }),
  [EVENT_CALENDAR_EVENT_CANCELLED]: entry({
    eventType: EVENT_CALENDAR_EVENT_CANCELLED,
    category: "calendar",
    defaultUrgency: "normal",
    recipientRule: "involved_parties",
    deepLinkPattern: CALENDAR_EVENT_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "detailed_ok",
    active: true,
  }),
  [EVENT_CALENDAR_REMINDER]: entry({
    eventType: EVENT_CALENDAR_REMINDER,
    category: "calendar",
    defaultUrgency: "normal",
    recipientRule: "involved_parties",
    deepLinkPattern: CALENDAR_EVENT_LINK,
    digestAllowed: false,
    actionOriented: true,
    privacy: "detailed_ok",
    active: true,
  }),
  [EVENT_CALENDAR_RSVP_CHANGED]: entry({
    eventType: EVENT_CALENDAR_RSVP_CHANGED,
    category: "calendar",
    defaultUrgency: "low",
    recipientRule: "explicit",
    deepLinkPattern: CALENDAR_EVENT_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "detailed_ok",
    active: true,
  }),
  [EVENT_CALENDAR_ATTENDEE_ADDED]: entry({
    eventType: EVENT_CALENDAR_ATTENDEE_ADDED,
    category: "calendar",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: CALENDAR_EVENT_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "detailed_ok",
    active: false,
  }),
  [EVENT_INVENTORY_LOW]: entry({
    eventType: EVENT_INVENTORY_LOW,
    category: "inventory",
    defaultUrgency: "normal",
    recipientRule: "other_active_members",
    deepLinkPattern: `${APP_LINK}/inventory/{entityId}`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "detailed_ok",
    active: false,
  }),
  [EVENT_SHOPPING_ITEM_REQUESTED]: entry({
    eventType: EVENT_SHOPPING_ITEM_REQUESTED,
    category: "shopping",
    defaultUrgency: "low",
    recipientRule: "other_active_members",
    deepLinkPattern: `${APP_LINK}/shopping/{entityId}`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "detailed_ok",
    active: false,
  }),
  [EVENT_MAINTENANCE_REPORTED]: entry({
    eventType: EVENT_MAINTENANCE_REPORTED,
    category: "maintenance",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/maintenance/{entityId}`,
    digestAllowed: false,
    actionOriented: true,
    privacy: "detailed_ok",
    active: false,
  }),
  [EVENT_MAINTENANCE_UPDATED]: entry({
    eventType: EVENT_MAINTENANCE_UPDATED,
    category: "maintenance",
    defaultUrgency: "normal",
    recipientRule: "actor_excluded",
    deepLinkPattern: `${APP_LINK}/maintenance/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "detailed_ok",
    active: false,
  }),
  [EVENT_APPROVAL_REQUESTED]: entry({
    eventType: EVENT_APPROVAL_REQUESTED,
    category: "approvals",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/approvals/{entityId}`,
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: false,
  }),
  [EVENT_APPROVAL_DECIDED]: entry({
    eventType: EVENT_APPROVAL_DECIDED,
    category: "approvals",
    defaultUrgency: "normal",
    recipientRule: "raiser",
    deepLinkPattern: `${APP_LINK}/approvals/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: false,
  }),
  [EVENT_AGREEMENT_ACKNOWLEDGMENT_REQUIRED]: entry({
    eventType: EVENT_AGREEMENT_ACKNOWLEDGMENT_REQUIRED,
    category: "agreements",
    defaultUrgency: "normal",
    recipientRule: "other_active_members",
    deepLinkPattern: `${APP_LINK}/agreements/{entityId}`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "generic_ok",
    active: false,
  }),
  [EVENT_AGREEMENT_ACCEPTED]: entry({
    eventType: EVENT_AGREEMENT_ACCEPTED,
    category: "agreements",
    defaultUrgency: "low",
    recipientRule: "involved_parties",
    deepLinkPattern: `${APP_LINK}/agreements/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: false,
  }),
  [EVENT_HOUSEHOLD_INVITATION_CREATED]: entry({
    eventType: EVENT_HOUSEHOLD_INVITATION_CREATED,
    category: "membership",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: "/join",
    digestAllowed: false,
    actionOriented: true,
    privacy: "routing_only",
    active: false,
  }),
  [EVENT_HOUSEHOLD_INVITATION_ACCEPTED]: entry({
    eventType: EVENT_HOUSEHOLD_INVITATION_ACCEPTED,
    category: "membership",
    defaultUrgency: "normal",
    recipientRule: "other_active_members",
    deepLinkPattern: APP_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "detailed_ok",
    active: false,
  }),
  [EVENT_HOUSEHOLD_MEMBER_JOINED]: entry({
    eventType: EVENT_HOUSEHOLD_MEMBER_JOINED,
    category: "membership",
    defaultUrgency: "normal",
    recipientRule: "other_active_members",
    deepLinkPattern: APP_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "detailed_ok",
    active: false,
  }),
  [EVENT_PAYMENT_ALLOCATION_CONFLICT]: entry({
    eventType: EVENT_PAYMENT_ALLOCATION_CONFLICT,
    category: "payments",
    defaultUrgency: "urgent",
    recipientRule: "involved_parties",
    deepLinkPattern: PAYMENT_LINK,
    digestAllowed: false,
    actionOriented: true,
    privacy: "routing_only",
    active: false,
  }),
  [EVENT_DISPUTE_UPDATED]: entry({
    eventType: EVENT_DISPUTE_UPDATED,
    category: "disputes",
    defaultUrgency: "normal",
    recipientRule: "involved_parties",
    deepLinkPattern: DISPUTE_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: false,
  }),
  [EVENT_DISPUTE_WITHDRAWN]: entry({
    eventType: EVENT_DISPUTE_WITHDRAWN,
    category: "disputes",
    defaultUrgency: "low",
    recipientRule: "other_active_members",
    deepLinkPattern: DISPUTE_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: false,
  }),
  [EVENT_EXPENSE_CONFIRMED]: entry({
    eventType: EVENT_EXPENSE_CONFIRMED,
    category: "expenses",
    defaultUrgency: "normal",
    recipientRule: "other_active_members",
    deepLinkPattern: EXPENSE_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: false,
  }),
  [EVENT_REIMBURSEMENT_REFUND_CREATED]: entry({
    eventType: EVENT_REIMBURSEMENT_REFUND_CREATED,
    category: "reimbursements",
    defaultUrgency: "high",
    recipientRule: "involved_parties",
    deepLinkPattern: REIMBURSEMENT_LINK,
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: false,
  }),
};

export function getCatalogEntry(eventType: string): CatalogEntry | undefined {
  return NOTIFICATION_CATALOG[eventType];
}

export const ACTIVE_EVENT_TYPES: readonly string[] = Object.values(
  NOTIFICATION_CATALOG,
)
  .filter((e) => e.active)
  .map((e) => e.eventType);

export function isActiveEventType(eventType: string): boolean {
  return getCatalogEntry(eventType)?.active === true;
}

export type CategoryPreferenceDefaults = {
  deliveryMode: DeliveryMode;
  channels: NotificationChannel[];
  defaultUrgency: NotificationUrgency;
  quietHoursRespected: boolean;
};

/** Default preference seeds by category (user prefs overlay these). */
export const CATEGORY_PREFERENCE_DEFAULTS: Record<
  NotificationCategory,
  CategoryPreferenceDefaults
> = {
  payments: {
    deliveryMode: "immediate",
    channels: ["in_app", "push"],
    defaultUrgency: "high",
    quietHoursRespected: true,
  },
  disputes: {
    deliveryMode: "immediate",
    channels: ["in_app", "push"],
    defaultUrgency: "high",
    quietHoursRespected: true,
  },
  expenses: {
    deliveryMode: "immediate",
    channels: ["in_app", "push"],
    defaultUrgency: "normal",
    quietHoursRespected: true,
  },
  reimbursements: {
    deliveryMode: "immediate",
    channels: ["in_app", "push"],
    defaultUrgency: "normal",
    quietHoursRespected: true,
  },
  membership: {
    deliveryMode: "immediate",
    channels: ["in_app", "push", "email"],
    defaultUrgency: "normal",
    quietHoursRespected: false,
  },
  chores: {
    deliveryMode: "daily_digest",
    channels: ["in_app", "push"],
    defaultUrgency: "normal",
    quietHoursRespected: true,
  },
  calendar: {
    deliveryMode: "immediate",
    channels: ["in_app", "push"],
    defaultUrgency: "normal",
    quietHoursRespected: true,
  },
  inventory: {
    deliveryMode: "daily_digest",
    channels: ["in_app", "push"],
    defaultUrgency: "normal",
    quietHoursRespected: true,
  },
  shopping: {
    deliveryMode: "daily_digest",
    channels: ["in_app", "push"],
    defaultUrgency: "low",
    quietHoursRespected: true,
  },
  maintenance: {
    deliveryMode: "immediate",
    channels: ["in_app", "push"],
    defaultUrgency: "high",
    quietHoursRespected: true,
  },
  approvals: {
    deliveryMode: "immediate",
    channels: ["in_app", "push"],
    defaultUrgency: "high",
    quietHoursRespected: true,
  },
  agreements: {
    deliveryMode: "immediate",
    channels: ["in_app", "push"],
    defaultUrgency: "normal",
    quietHoursRespected: true,
  },
  system: {
    deliveryMode: "immediate",
    channels: ["in_app"],
    defaultUrgency: "normal",
    quietHoursRespected: false,
  },
};
