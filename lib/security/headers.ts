/**
 * Security headers for every response (next.config.ts). The CSP allows only this origin plus the Supabase project
 * (API, Realtime websocket, Storage signed URLs). Next's inline bootstrap scripts need 'unsafe-inline' (no nonces:
 * pages are statically optimised); 'unsafe-eval' only in development (React refresh). See ADR-024.
 */
export function securityHeaders({ supabaseUrl, dev }: { supabaseUrl: string; dev: boolean }) {
  const supabase = new URL(supabaseUrl);
  const ws = `${supabase.protocol === "https:" ? "wss" : "ws"}://${supabase.host}`;
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase.origin}`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabase.origin} ${ws}`,
    "worker-src 'self' blob:",
    "frame-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
    ...(dev
      ? []
      : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
  ];
}
