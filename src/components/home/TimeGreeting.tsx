"use client";

import { useEffect, useState } from "react";
import { timeOfDayGreeting } from "@/lib/presentation/human-status";

export function TimeGreeting() {
  const [greeting, setGreeting] = useState("Home");

  useEffect(() => {
    setGreeting(timeOfDayGreeting(new Date()));
  }, []);

  return <>{greeting}</>;
}
