import "server-only";

import {
  parseServerEnv,
  type ServerEnv,
  type RegistrationMode,
  REGISTRATION_MODES,
  normalizeEmail,
} from "@/lib/env/server-schema";

export {
  parseServerEnv,
  REGISTRATION_MODES,
  normalizeEmail,
  type ServerEnv,
  type RegistrationMode,
};

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (!cached) {
    cached = parseServerEnv();
  }
  return cached;
}

/** Test helper — clears memoized server env. */
export function resetServerEnvCache(): void {
  cached = undefined;
}
