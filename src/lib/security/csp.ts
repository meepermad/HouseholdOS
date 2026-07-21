/**
 * Content-Security-Policy helpers.
 *
 * React Flight / App Router streaming depends on inline `$RC` / `$RS` scripts.
 * Those scripts only run when `script-src` allows them via a per-request nonce
 * (or `'unsafe-inline'`). A static CSP without either leaves Suspense fallbacks
 * mounted forever while completed HTML stays in hidden `#S:*` slots.
 */

export function createCspNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

export function buildContentSecurityPolicy(options: {
  nonce: string;
  supabaseOrigin?: string;
  isDev?: boolean;
}): string {
  const isDev = options.isDev ?? process.env.NODE_ENV === "development";
  const connectSrc = [
    "'self'",
    options.supabaseOrigin,
    "https://*.supabase.co",
    "wss://*.supabase.co",
  ]
    .filter(Boolean)
    .join(" ");

  const scriptSrc = [
    "'self'",
    `'nonce-${options.nonce}'`,
    "'strict-dynamic'",
    "'unsafe-eval'",
    "'wasm-unsafe-eval'",
    "blob:",
    ...(isDev ? [] : []),
  ].join(" ");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSrc}`,
    "worker-src 'self' blob:",
    `connect-src ${connectSrc}`,
    "media-src 'self' blob:",
    "manifest-src 'self'",
  ].join("; ");
}
