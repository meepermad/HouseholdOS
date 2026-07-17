import { z } from "zod";
import {
  MAINTENANCE_CATEGORIES,
  MAINTENANCE_DECISIONS,
  MAINTENANCE_SEVERITIES,
  MAINTENANCE_VISIBILITIES,
  SAFETY_HAZARD_FLAGS,
  VENDOR_CONTACT_TYPES,
} from "@/lib/maintenance";

export const createMaintenanceRequestSchema = z.object({
  householdId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(8000).optional().nullable(),
  category: z.enum(MAINTENANCE_CATEGORIES).default("other"),
  severity: z.enum(MAINTENANCE_SEVERITIES).default("normal"),
  visibility: z.enum(MAINTENANCE_VISIBILITIES).default("household"),
  locationId: z.string().uuid().optional().nullable(),
  inventoryItemId: z.string().uuid().optional().nullable(),
  firstNoticedAt: z.string().optional().nullable(),
  currentlyActive: z.boolean().default(true),
  stopUse: z.boolean().default(false),
  immediateMitigation: z.string().trim().max(4000).optional().nullable(),
  hazardFlags: z.array(z.enum(SAFETY_HAZARD_FLAGS)).default([]),
  suggestedCoordinatorMembershipId: z.string().uuid().optional().nullable(),
  landlordInvolvement: z.boolean().default(false),
});

export const maintenanceRequestIdSchema = z.object({
  householdId: z.string().uuid(),
  requestId: z.string().uuid(),
});

export const assignMaintenanceSchema = maintenanceRequestIdSchema.extend({
  membershipId: z.string().uuid(),
  isPrimary: z.boolean().default(true),
});

export const commentMaintenanceSchema = maintenanceRequestIdSchema.extend({
  body: z.string().trim().min(1).max(4000),
});

export const resolveMaintenanceSchema = maintenanceRequestIdSchema.extend({
  resolutionNotes: z.string().trim().max(4000).optional().nullable(),
  decisionOutcome: z.enum(MAINTENANCE_DECISIONS).optional().nullable(),
});

export const waitingStatusSchema = maintenanceRequestIdSchema.extend({
  status: z.enum([
    "waiting_on_household",
    "waiting_on_landlord",
    "waiting_on_vendor",
    "appointment_scheduled",
    "in_progress",
    "assigned",
  ]),
});

export const createVendorSchema = z.object({
  householdId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(200),
  contactType: z.enum(VENDOR_CONTACT_TYPES),
  organization: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(320).optional().nullable().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const scheduleAppointmentSchema = maintenanceRequestIdSchema.extend({
  title: z.string().trim().min(1).max(200),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  appointmentKind: z.string().default("vendor_visit"),
  location: z.string().trim().max(500).optional().nullable(),
});
