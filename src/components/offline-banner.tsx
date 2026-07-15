"use client";

import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="safe-pt sticky top-0 z-50 border-b border-warning bg-warning-soft px-4 py-2 text-center text-sm text-warning"
      data-testid="offline-banner"
    >
      You are offline. Browse carefully — money actions will not save until you
      reconnect. Do not assume a confirmation succeeded while disconnected.
    </div>
  );
}
