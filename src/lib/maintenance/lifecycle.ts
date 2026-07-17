import type { MaintenanceStatus } from "./types";

const TRANSITIONS: Record<MaintenanceStatus, readonly MaintenanceStatus[]> = {
  reported: ["triaged", "assigned", "cancelled", "waiting_on_household"],
  triaged: [
    "assigned",
    "waiting_on_household",
    "waiting_on_landlord",
    "waiting_on_vendor",
    "cancelled",
  ],
  assigned: [
    "waiting_on_household",
    "waiting_on_landlord",
    "waiting_on_vendor",
    "appointment_scheduled",
    "in_progress",
    "resolved",
    "cancelled",
  ],
  waiting_on_household: [
    "assigned",
    "waiting_on_landlord",
    "waiting_on_vendor",
    "appointment_scheduled",
    "in_progress",
    "resolved",
    "cancelled",
  ],
  waiting_on_landlord: [
    "waiting_on_vendor",
    "appointment_scheduled",
    "in_progress",
    "waiting_on_household",
    "resolved",
    "cancelled",
  ],
  waiting_on_vendor: [
    "appointment_scheduled",
    "in_progress",
    "waiting_on_landlord",
    "waiting_on_household",
    "resolved",
    "cancelled",
  ],
  appointment_scheduled: [
    "in_progress",
    "waiting_on_vendor",
    "waiting_on_landlord",
    "waiting_on_household",
    "resolved",
    "cancelled",
  ],
  in_progress: [
    "waiting_on_household",
    "waiting_on_landlord",
    "waiting_on_vendor",
    "appointment_scheduled",
    "resolved",
    "cancelled",
  ],
  resolved: ["closed", "reopened"],
  closed: ["reopened"],
  reopened: [
    "assigned",
    "waiting_on_household",
    "waiting_on_landlord",
    "waiting_on_vendor",
    "appointment_scheduled",
    "in_progress",
    "resolved",
    "cancelled",
  ],
  cancelled: [],
};

export function canTransitionMaintenanceStatus(
  from: MaintenanceStatus,
  to: MaintenanceStatus,
): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

export function assertMaintenanceTransition(
  from: MaintenanceStatus,
  to: MaintenanceStatus,
): void {
  if (!canTransitionMaintenanceStatus(from, to)) {
    throw new Error(`Invalid maintenance transition: ${from} → ${to}`);
  }
}

export function isOpenMaintenanceStatus(status: MaintenanceStatus): boolean {
  return ![
    "resolved",
    "closed",
    "cancelled",
  ].includes(status);
}

export function shouldCancelObsoleteReminders(
  status: MaintenanceStatus,
): boolean {
  return status === "resolved" || status === "closed" || status === "cancelled";
}
