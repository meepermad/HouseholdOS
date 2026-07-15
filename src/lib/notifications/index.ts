export {
  ACTIVE_EVENT_TYPES,
  CATEGORY_PREFERENCE_DEFAULTS,
  CONCEPTUAL_EVENT_ALIASES,
  EVENT_AGREEMENT_ACCEPTED,
  EVENT_AGREEMENT_PROPOSED,
  EVENT_APPROVAL_DECIDED,
  EVENT_APPROVAL_REQUESTED,
  EVENT_CALENDAR_REMINDER,
  EVENT_CALENDAR_UPDATED,
  EVENT_CHORE_ASSIGNED,
  EVENT_CHORE_COMPLETED,
  EVENT_CHORE_DUE,
  EVENT_DISPUTE_OPENED,
  EVENT_DISPUTE_RESOLVED,
  EVENT_DISPUTE_UPDATED,
  EVENT_DISPUTE_WITHDRAWN,
  EVENT_EXPENSE_AMENDED,
  EVENT_EXPENSE_CONFIRMED,
  EVENT_EXPENSE_VOIDED,
  EVENT_HOUSEHOLD_INVITATION_ACCEPTED,
  EVENT_HOUSEHOLD_INVITATION_CREATED,
  EVENT_HOUSEHOLD_MEMBER_JOINED,
  EVENT_INVENTORY_LOW,
  EVENT_MAINTENANCE_COMPLETED,
  EVENT_MAINTENANCE_DUE,
  EVENT_PAYMENT_ALLOCATION_CONFLICT,
  EVENT_PAYMENT_AWAITING_CONFIRMATION,
  EVENT_PAYMENT_CANCELLED,
  EVENT_PAYMENT_CONFIRMED,
  EVENT_PAYMENT_REJECTED,
  EVENT_PAYMENT_REVERSED,
  EVENT_PAYMENT_SUBMITTED,
  EVENT_REFUND_OBLIGATION_CREATED,
  EVENT_REIMBURSEMENT_REFUND_CREATED,
  EVENT_REIMBURSEMENT_WAIVED,
  EVENT_REIMBURSEMENT_WAIVER_REVERSED,
  EVENT_SHOPPING_ITEM_REQUESTED,
  EVENT_WAIVER_CREATED,
  EVENT_WAIVER_REVERSED,
  getCatalogEntry,
  isActiveEventType,
  NOTIFICATION_CATALOG,
  type CatalogEntry,
  type CategoryPreferenceDefaults,
  type DeliveryMode,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationUrgency,
  type PrivacyClass,
  type RecipientRule,
} from "@/lib/notifications/catalog";

export {
  buildPushContent,
  MAX_PUSH_PAYLOAD_BYTES,
  stripSensitive,
  TEST_NOTIFICATION_TEMPLATE,
  validatePushPayloadSize,
  type PrivacyPreview,
  type PushContent,
} from "@/lib/notifications/templates";

export {
  FALLBACK_DEEP_LINK,
  isSafeInternalRoute,
  normalizeDeepLink,
  sanitizeNotificationDataUrl,
} from "@/lib/notifications/deep-links";

export {
  addCalendarDays,
  getLocalParts,
  isWithinQuietHours,
  nextQuietHoursEnd,
  parseHhMm,
  resolveAvailableAt,
  resolveTimeZone,
  zonedLocalToUtc,
  type LocalTimeParts,
  type QuietHoursConfig,
} from "@/lib/notifications/quiet-hours";

export {
  applyJitter,
  BACKOFF_DELAYS_MS,
  classifyPushError,
  MAX_ATTEMPTS,
  nextRetryAt,
  shouldDeactivateSubscription,
  type PushErrorClassification,
} from "@/lib/notifications/retry";

export {
  describeRecipientRule,
  expectedRecipientRule,
  PHASE3_RECIPIENT_RULES,
  type RecipientRuleExpectation,
} from "@/lib/notifications/recipients";

export {
  hashEndpoint,
  pushSubscriptionClientSchema,
  pushSubscriptionKeysSchema,
  summarizeUserAgent,
  type PushSubscriptionClient,
  type UserAgentSummary,
} from "@/lib/notifications/subscription";

export {
  shouldClearBadge,
  unreadBadgeCount,
  type BadgeNotification,
} from "@/lib/notifications/badge";

export {
  detectPushSupport,
  type PushSupportResult,
  type PushSupportState,
} from "@/lib/notifications/push-support";

export {
  DIGEST_HOUR_LOCAL,
  groupDigestItems,
  nextDigestAt,
  type DigestCategoryGroup,
  type DigestHouseholdGroup,
  type DigestItem,
} from "@/lib/notifications/digest";

export {
  buildScheduleIdempotencyKey,
  isScheduleCancelled,
  type ScheduleRequestInput,
} from "@/lib/notifications/scheduled";
