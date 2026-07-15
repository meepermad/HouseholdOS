import { z } from "zod";
import { CALENDAR_CATEGORIES } from "@/lib/calendar/categories";
import { CALENDAR_VISIBILITIES } from "@/lib/calendar/visibility";
import { FEED_SCOPES } from "@/lib/calendar/feed-token";
import { MAX_GUEST_COUNT } from "@/lib/calendar/headcount";
import {
  MAX_REMINDERS_PER_EVENT,
  MAX_REMINDER_OFFSET_MINUTES,
  MIN_REMINDER_OFFSET_MINUTES,
} from "@/lib/calendar/reminders";
import { isValidIanaTimeZone } from "@/lib/calendar/time-mode";

const uuid = z.string().uuid();

export const calendarCategorySchema = z.enum(CALENDAR_CATEGORIES);
export const calendarVisibilitySchema = z.enum(CALENDAR_VISIBILITIES);
export const rsvpStatusSchema = z.enum([
  "needs_action",
  "going",
  "maybe",
  "not_going",
]);

const calendarEventFieldsSchema = z.object({
  householdId: uuid,
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  location: z.string().trim().max(500).optional().or(z.literal("")),
  category: calendarCategorySchema,
  visibility: calendarVisibilitySchema,
  allDay: z.boolean(),
  startsAt: z.string().datetime({ offset: true }).optional().nullable(),
  endsAt: z.string().datetime({ offset: true }).optional().nullable(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  endDateExclusive: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  timeZone: z.string().trim().min(1),
  rrule: z.string().trim().max(1000).optional().nullable(),
  recurrenceUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  recurrenceCount: z.number().int().min(1).max(520).optional().nullable(),
  eventGuestCount: z.number().int().min(0).max(MAX_GUEST_COUNT).default(0),
  guestLabel: z.string().trim().max(120).optional().or(z.literal("")),
  attendeeMembershipIds: z.array(uuid).max(20).default([]),
  reminderOffsetsMinutes: z
    .array(
      z
        .number()
        .int()
        .min(MIN_REMINDER_OFFSET_MINUTES)
        .max(MAX_REMINDER_OFFSET_MINUTES),
    )
    .max(MAX_REMINDERS_PER_EVENT)
    .default([60]),
  clientIdempotencyKey: z.string().trim().min(8).max(120),
});

function refineEventTimeMode(
  data: {
    allDay: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
    startDate?: string | null;
    endDateExclusive?: string | null;
    timeZone: string;
  },
  ctx: z.RefinementCtx,
) {
  if (!isValidIanaTimeZone(data.timeZone)) {
    ctx.addIssue({
      code: "custom",
      message: "Invalid timezone.",
      path: ["timeZone"],
    });
  }
  if (data.allDay) {
    if (!data.startDate || !data.endDateExclusive) {
      ctx.addIssue({
        code: "custom",
        message: "All-day events need start and exclusive end dates.",
      });
    } else if (data.endDateExclusive <= data.startDate) {
      ctx.addIssue({
        code: "custom",
        message: "Exclusive end date must be after start date.",
      });
    }
    if (data.startsAt || data.endsAt) {
      ctx.addIssue({
        code: "custom",
        message: "All-day events cannot include timed timestamps.",
      });
    }
  } else {
    if (!data.startsAt || !data.endsAt) {
      ctx.addIssue({
        code: "custom",
        message: "Timed events require start and end.",
      });
    } else if (new Date(data.endsAt) <= new Date(data.startsAt)) {
      ctx.addIssue({
        code: "custom",
        message: "Event end must be after start.",
      });
    }
    if (data.startDate || data.endDateExclusive) {
      ctx.addIssue({
        code: "custom",
        message: "Timed events cannot include all-day date fields.",
      });
    }
  }
}

export const createCalendarEventSchema = calendarEventFieldsSchema.superRefine(
  refineEventTimeMode,
);

export const updateCalendarEventSchema = calendarEventFieldsSchema
  .omit({ clientIdempotencyKey: true })
  .extend({
    eventId: uuid,
    coordinatorOverride: z.boolean().default(false),
  })
  .superRefine(refineEventTimeMode);

export const respondToCalendarEventSchema = z.object({
  householdId: uuid,
  eventId: uuid,
  rsvpStatus: rsvpStatusSchema,
  guestCount: z.number().int().min(0).max(MAX_GUEST_COUNT).default(0),
  guestNote: z.string().trim().max(240).optional().or(z.literal("")),
});

export const cancelCalendarEventSchema = z.object({
  householdId: uuid,
  eventId: uuid,
  reason: z.string().trim().max(500).optional().or(z.literal("")),
  coordinatorOverride: z.boolean().default(false),
});

export const updateOccurrenceSchema = z.object({
  householdId: uuid,
  eventId: uuid,
  originalStartsAt: z.string().datetime({ offset: true }),
  allDay: z.boolean().optional(),
  startsAt: z.string().datetime({ offset: true }).optional().nullable(),
  endsAt: z.string().datetime({ offset: true }).optional().nullable(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  endDateExclusive: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).optional().nullable(),
  location: z.string().trim().max(500).optional().nullable(),
  eventGuestCount: z.number().int().min(0).max(MAX_GUEST_COUNT).optional(),
  guestLabel: z.string().trim().max(120).optional().nullable(),
});

export const cancelOccurrenceSchema = z.object({
  householdId: uuid,
  eventId: uuid,
  originalStartsAt: z.string().datetime({ offset: true }),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export const createFeedSchema = z.object({
  householdId: uuid,
  label: z.string().trim().min(1).max(120).default("Personal calendar feed"),
  scope: z.enum(FEED_SCOPES).default("visible_to_me"),
});

export const feedIdSchema = z.object({
  householdId: uuid,
  feedId: uuid,
});
