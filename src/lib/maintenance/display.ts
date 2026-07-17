import type {
  MaintenanceCategory,
  MaintenanceSeverity,
  MaintenanceStatus,
} from "./types";

export function maintenanceSeverityLabel(severity: MaintenanceSeverity): string {
  switch (severity) {
    case "low":
      return "Low";
    case "normal":
      return "Normal";
    case "high":
      return "High";
    case "urgent":
      return "Urgent";
    case "emergency_guidance":
      return "Emergency guidance";
  }
}

export function maintenanceStatusLabel(status: MaintenanceStatus): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function maintenanceCategoryLabel(category: MaintenanceCategory): string {
  return category
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Color-independent severity mark for a11y. */
export function maintenanceSeverityMark(severity: MaintenanceSeverity): string {
  switch (severity) {
    case "low":
      return "·";
    case "normal":
      return "••";
    case "high":
      return "!!!";
    case "urgent":
      return "!!!!";
    case "emergency_guidance":
      return "⚠";
  }
}
