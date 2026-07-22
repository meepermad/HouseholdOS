"use client";

import { useEffect } from "react";

/** Scroll to #create-household when arriving via intent=create-household (hash is lost on server redirects). */
export function CreateHouseholdOnboardingAnchor({
  intent,
}: {
  intent?: string | null;
}) {
  useEffect(() => {
    if (intent !== "create-household") return;
    const el = document.getElementById("create-household");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      if (window.location.hash !== "#create-household") {
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}#create-household`,
        );
      }
    }
  }, [intent]);

  return null;
}
