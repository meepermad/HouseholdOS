export type {
  EvidenceMimeType,
  LandlordWorkflowStatus,
  MaintenanceCategory,
  MaintenanceDecision,
  MaintenanceEventType,
  MaintenanceSeverity,
  MaintenanceStatus,
  MaintenanceVisibility,
  SafetyHazardFlag,
  VendorContactType,
} from "./types";
export {
  EVIDENCE_ALLOWED_MIME_TYPES,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MAX_COUNT_PER_REQUEST,
  LANDLORD_WORKFLOW_STATUSES,
  MAINTENANCE_CATEGORIES,
  MAINTENANCE_DECISIONS,
  MAINTENANCE_EVENT_TYPES,
  MAINTENANCE_SEVERITIES,
  MAINTENANCE_STATUSES,
  MAINTENANCE_VISIBILITIES,
  SAFETY_HAZARD_FLAGS,
  VENDOR_CONTACT_TYPES,
} from "./types";

export {
  assertMaintenanceTransition,
  canTransitionMaintenanceStatus,
  isOpenMaintenanceStatus,
  shouldCancelObsoleteReminders,
} from "./lifecycle";

export {
  EMERGENCY_DISCLAIMER,
  safetyGuidanceForHazard,
  safetyGuidanceForHazards,
  shouldForceEmergencyGuidanceSeverity,
} from "./safety";
export type { SafetyGuidance } from "./safety";

export { detectDuplicateMaintenanceIssues } from "./duplicates";
export type {
  DuplicateCandidate,
  DuplicateDetectionInput,
  DuplicateDetectionResult,
  DuplicateOutcome,
} from "./duplicates";

export {
  redactEvidencePathForNotification,
  validateMaintenanceEvidence,
} from "./evidence";
export type {
  EvidenceValidationInput,
  EvidenceValidationResult,
} from "./evidence";

export {
  maintenanceCategoryLabel,
  maintenanceSeverityLabel,
  maintenanceSeverityMark,
  maintenanceStatusLabel,
} from "./display";
