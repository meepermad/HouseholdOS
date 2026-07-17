/**
 * Deterministic safety triage guidance.
 * Never claims the app contacted emergency services.
 */

import type { MaintenanceSeverity, SafetyHazardFlag } from "./types";

export type SafetyGuidance = {
  hazard: SafetyHazardFlag;
  title: string;
  guidance: string[];
  recommendEmergencyServices: boolean;
  /** App never claims contact occurred. */
  didContactEmergencyServices: false;
};

const GUIDANCE: Record<SafetyHazardFlag, Omit<SafetyGuidance, "hazard" | "didContactEmergencyServices">> = {
  water_actively_leaking: {
    title: "Active water leak",
    guidance: [
      "If safe, shut off the local supply valve you already know how to operate.",
      "Move belongings away from standing water.",
      "Contact your landlord, property manager, or a licensed plumber.",
    ],
    recommendEmergencyServices: false,
  },
  burning_smell: {
    title: "Burning smell",
    guidance: [
      "Leave the area if the smell is strong or worsening.",
      "If safe and you know how, shut off power at the breaker for the affected circuit.",
      "Contact emergency services if you see smoke or fire, otherwise call a licensed electrician or your utility.",
    ],
    recommendEmergencyServices: true,
  },
  sparks_or_arcing: {
    title: "Sparks or electrical arcing",
    guidance: [
      "Do not touch the equipment.",
      "Leave the area if unsafe.",
      "If safe and clearly understood, shut off power at the breaker.",
      "Contact emergency services for active fire risk, otherwise a licensed electrician.",
    ],
    recommendEmergencyServices: true,
  },
  gas_odor: {
    title: "Gas odor",
    guidance: [
      "Leave the building immediately. Do not operate switches or create sparks.",
      "From a safe location, contact your gas utility emergency line and emergency services.",
      "Do not attempt DIY gas repairs.",
    ],
    recommendEmergencyServices: true,
  },
  smoke_or_fire: {
    title: "Smoke or fire",
    guidance: [
      "Evacuate immediately.",
      "Call emergency services from a safe location.",
      "Do not re-enter until responders say it is safe.",
    ],
    recommendEmergencyServices: true,
  },
  carbon_monoxide_alarm: {
    title: "Carbon monoxide alarm",
    guidance: [
      "Leave the building immediately and get fresh air.",
      "Call emergency services from a safe location.",
      "Do not re-enter until cleared by responders or a qualified professional.",
    ],
    recommendEmergencyServices: true,
  },
  door_cannot_secure: {
    title: "Door cannot secure",
    guidance: [
      "Stay with someone if possible and keep valuables secure.",
      "Contact your landlord, property manager, or a lock professional promptly.",
      "Call emergency services if you are in immediate personal danger.",
    ],
    recommendEmergencyServices: false,
  },
  major_structural_movement: {
    title: "Major structural movement",
    guidance: [
      "Leave the area if it feels unsafe.",
      "Do not attempt structural DIY repairs.",
      "Contact emergency services for immediate danger, otherwise a licensed structural professional and your landlord.",
    ],
    recommendEmergencyServices: true,
  },
  standing_water_near_electricity: {
    title: "Standing water near electricity",
    guidance: [
      "Do not enter the water or touch electrical equipment.",
      "If safe and clearly understood, shut off power at the main breaker from a dry location.",
      "Contact emergency services for immediate danger, otherwise a licensed electrician and your landlord.",
    ],
    recommendEmergencyServices: true,
  },
};

export function safetyGuidanceForHazard(hazard: SafetyHazardFlag): SafetyGuidance {
  const g = GUIDANCE[hazard];
  return {
    hazard,
    ...g,
    didContactEmergencyServices: false,
  };
}

export function safetyGuidanceForHazards(
  hazards: readonly SafetyHazardFlag[],
): SafetyGuidance[] {
  return hazards.map(safetyGuidanceForHazard);
}

export function shouldForceEmergencyGuidanceSeverity(
  hazards: readonly SafetyHazardFlag[],
  severity: MaintenanceSeverity,
): boolean {
  if (severity === "emergency_guidance") return true;
  return hazards.some((h) => GUIDANCE[h].recommendEmergencyServices);
}

export const EMERGENCY_DISCLAIMER =
  "HouseholdOS does not contact emergency services. If you are in danger, call your local emergency number.";
