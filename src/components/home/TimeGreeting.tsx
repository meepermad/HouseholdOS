"use client";

import { useSyncExternalStore } from "react";
import { timeOfDayGreeting } from "@/lib/presentation/human-status";

function subscribeGreeting(): () => void {
  return () => undefined;
}

export function TimeGreeting() {
  const greeting = useSyncExternalStore(
    subscribeGreeting,
    () => timeOfDayGreeting(new Date()),
    () => "Home",
  );

  return <>{greeting}</>;
}
