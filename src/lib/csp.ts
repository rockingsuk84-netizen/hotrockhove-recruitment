/**
 * Content Security Policy — the single place where allowed sources are defined.
 *
 * Third-party origins:
 *  - https://challenges.cloudflare.com — Cloudflare Turnstile script (script-src),
 *    widget iframe (frame-src) and its verification requests (connect-src).
 *
 * Documented exceptions:
 *  - style-src-attr 'unsafe-inline': the Turnstile loader sizes its container
 *    with inline style attributes. This allows style *attributes* only; <style>
 *    elements still require the per-request nonce and no script exception exists.
 *  - img-src https:: the brand logo is an admin-configured HTTPS URL. Images
 *    cannot execute code; restrict to a single host here if the logo is fixed.
 *  - 'unsafe-eval' is added in development only (React dev tooling), never in production.
 */
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

export function buildCsp(nonce: string, opts: { isDev: boolean }): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", TURNSTILE_ORIGIN, ...(opts.isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", `'nonce-${nonce}'`],
    "style-src-attr": ["'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", TURNSTILE_ORIGIN],
    "frame-src": [TURNSTILE_ORIGIN],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const policy = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!opts.isDev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}
