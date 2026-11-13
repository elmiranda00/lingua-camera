// Security headers for every response
//
// The CSP enforces one origin only. Never loosen it: China blocks most third-party hosts

export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "connect-src 'self'",
].join("; ");

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Content-Security-Policy": CSP,
  // Cross-origin isolation: lets the OCR use several threads (SharedArrayBuffer). Safe because every file is same-origin.
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Permissions-Policy": "camera=(self)",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export function applySecurityHeaders(headers: Headers): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
}
