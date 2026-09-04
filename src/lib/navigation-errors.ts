/** Next.js `redirect()` / `notFound()` throw a digest-bearing error. */
export function isNextRedirectError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}
