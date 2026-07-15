export function prefersReducedMotion(
  mediaMatches?: (query: string) => boolean,
): boolean {
  const matches =
    mediaMatches ??
    (typeof window !== "undefined"
      ? (q: string) => window.matchMedia(q).matches
      : () => false);
  return matches("(prefers-reduced-motion: reduce)");
}
