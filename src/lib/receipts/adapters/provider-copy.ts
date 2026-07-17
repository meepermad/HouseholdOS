/** Client-safe provider disclosure copy (no server-only imports). */

export function describeProviderChoices(): {
  local: { title: string; body: string };
  cloud: { title: string; body: string };
} {
  return {
    local: {
      title: "Local OCR",
      body: "Free, private, processed on this device. Best for clear receipts and manual review.",
    },
    cloud: {
      title: "Cloud extraction",
      body: "Optional, may improve difficult receipts. Requires configured provider credentials and sends the receipt to that provider.",
    },
  };
}
