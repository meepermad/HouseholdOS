/** Phase 7B maintenance domain types. */

export const MAINTENANCE_CATEGORIES = [
  "plumbing",
  "electrical",
  "hvac",
  "appliance",
  "structural",
  "water_damage",
  "pest",
  "safety",
  "security",
  "internet_technology",
  "furniture",
  "cleaning_damage",
  "outdoor",
  "utility",
  "other",
] as const;
export type MaintenanceCategory = (typeof MAINTENANCE_CATEGORIES)[number];

export const MAINTENANCE_SEVERITIES = [
  "low",
  "normal",
  "high",
  "urgent",
  "emergency_guidance",
] as const;
export type MaintenanceSeverity = (typeof MAINTENANCE_SEVERITIES)[number];

export const MAINTENANCE_STATUSES = [
  "reported",
  "triaged",
  "assigned",
  "waiting_on_household",
  "waiting_on_landlord",
  "waiting_on_vendor",
  "appointment_scheduled",
  "in_progress",
  "resolved",
  "closed",
  "reopened",
  "cancelled",
] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const MAINTENANCE_VISIBILITIES = [
  "household",
  "participants",
  "coordinators",
] as const;
export type MaintenanceVisibility = (typeof MAINTENANCE_VISIBILITIES)[number];

export const MAINTENANCE_DECISIONS = [
  "repair",
  "replace",
  "monitor",
  "dispose",
  "return",
  "warranty_claim",
  "landlord_action",
  "no_action",
] as const;
export type MaintenanceDecision = (typeof MAINTENANCE_DECISIONS)[number];

export const SAFETY_HAZARD_FLAGS = [
  "water_actively_leaking",
  "burning_smell",
  "sparks_or_arcing",
  "gas_odor",
  "smoke_or_fire",
  "carbon_monoxide_alarm",
  "door_cannot_secure",
  "major_structural_movement",
  "standing_water_near_electricity",
] as const;
export type SafetyHazardFlag = (typeof SAFETY_HAZARD_FLAGS)[number];

export const VENDOR_CONTACT_TYPES = [
  "landlord",
  "property_manager",
  "maintenance_company",
  "plumber",
  "electrician",
  "hvac_company",
  "appliance_repair",
  "pest_control",
  "utility",
  "internet_provider",
  "other",
] as const;
export type VendorContactType = (typeof VENDOR_CONTACT_TYPES)[number];

export const LANDLORD_WORKFLOW_STATUSES = [
  "drafting_report",
  "submitted_externally",
  "acknowledged",
  "scheduled",
  "completed",
  "disputed",
  "no_response",
] as const;
export type LandlordWorkflowStatus = (typeof LANDLORD_WORKFLOW_STATUSES)[number];

export const MAINTENANCE_EVENT_TYPES = [
  "reported",
  "triaged",
  "severity_changed",
  "assigned",
  "unassigned",
  "comment_added",
  "mitigation_recorded",
  "contact_attempted",
  "external_reference_added",
  "appointment_scheduled",
  "appointment_changed",
  "appointment_cancelled",
  "work_started",
  "work_completed",
  "condition_changed",
  "expense_linked",
  "waiting_status_changed",
  "resolved",
  "closed",
  "reopened",
  "cancelled",
  "evidence_added",
  "evidence_removed",
] as const;
export type MaintenanceEventType = (typeof MAINTENANCE_EVENT_TYPES)[number];

export const EVIDENCE_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;
export type EvidenceMimeType = (typeof EVIDENCE_ALLOWED_MIME_TYPES)[number];

export const EVIDENCE_MAX_BYTES = 8 * 1024 * 1024; // 8 MiB
export const EVIDENCE_MAX_COUNT_PER_REQUEST = 12;
