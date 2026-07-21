"use client";

import { useEffect, useState } from "react";

export function ServiceWorkerUpdateBanner({
  buildLabel,
}: {
  buildLabel?: string;
}) {
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let registration: ServiceWorkerRegistration | undefined;
    let cancelled = false;

    const onControllerChange = () => {
      window.location.reload();
    };

    const onUpdateFound = () => {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (
          installing.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          setWaiting(true);
        }
      });
    };

    void navigator.serviceWorker.ready.then((reg) => {
      if (cancelled) return;
      registration = reg;
      if (reg.waiting) setWaiting(true);
      reg.addEventListener("updatefound", onUpdateFound);
    });

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    return () => {
      cancelled = true;
      registration?.removeEventListener("updatefound", onUpdateFound);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  if (!waiting) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-40 border-b border-info bg-info-soft px-4 py-2 text-center text-sm text-info"
      data-testid="sw-update-banner"
    >
      <span>
        A newer version of HouseholdOS is available
        {buildLabel ? ` (current build ${buildLabel})` : ""}.{" "}
      </span>
      <button
        type="button"
        className="font-semibold underline"
        onClick={() => {
          void navigator.serviceWorker.ready.then((reg) => {
            reg.waiting?.postMessage({ type: "SKIP_WAITING" });
            if (!reg.waiting) window.location.reload();
          });
        }}
      >
        Refresh to update
      </button>
    </div>
  );
}
