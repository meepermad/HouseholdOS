import { DOCUMENT_LOAD_WATCHDOG_SCRIPT } from "@/lib/document-load-watchdog-script";

/** Blocking inline watchdog — does not depend on React hydration. */
export function DocumentLoadWatchdogScript() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: DOCUMENT_LOAD_WATCHDOG_SCRIPT }}
    />
  );
}
