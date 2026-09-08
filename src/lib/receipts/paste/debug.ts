/** Development/test-only paste parser debugger. Never shown in production builds. */
export function isPasteParserDebugEnabled(
  env: { NODE_ENV?: string; APP_ENV?: string } = process.env,
): boolean {
  return env.NODE_ENV !== "production" && env.APP_ENV !== "production";
}
