/** Detect installed / standalone PWA display mode (client only). */
export function isStandaloneDisplayMode(
  mediaMatches?: (query: string) => boolean,
  navigatorStandalone?: boolean,
): boolean {
  const matches =
    mediaMatches ??
    (typeof window !== "undefined"
      ? (q: string) => window.matchMedia(q).matches
      : () => false);

  if (matches("(display-mode: standalone)")) return true;
  if (matches("(display-mode: fullscreen)")) return true;
  if (navigatorStandalone === true) return true;
  if (
    typeof navigator !== "undefined" &&
    "standalone" in navigator &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  ) {
    return true;
  }
  return false;
}
