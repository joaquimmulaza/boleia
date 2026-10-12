/**
 * Guard `/__dev/*` (Critiquito): allowlist estrita em build prod + `import.meta.env.DEV` (vite local).
 *
 * Permitido: `localhost`, `127.0.0.1`, e
 * `^boleia-[a-z0-9]{9}-joaquim-mulazas-projects\.vercel\.app$` (preview deployment hash).
 * Todo o resto (prod, `boleia-git-*`, custom) → negado.
 */

/** @type {readonly string[]} */
export const DEV_CAPTURE_LOCAL_HOSTS = ['localhost', '127.0.0.1'];

/** Preview Vercel — hash exactamente 9 caracteres alfanuméricos. */
export const DEV_CAPTURE_PREVIEW_HOST_PATTERN =
  /^boleia-[a-z0-9]{9}-joaquim-mulazas-projects\.vercel\.app$/i;

/**
 * @param {string} [hostname]
 * @returns {string}
 */
function resolveHostname(hostname) {
  return (hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase();
}

/**
 * Allowlist (sem `import.meta.env.DEV`).
 *
 * @param {string} [hostname]
 * @returns {boolean}
 */
export function isDevCaptureAllowedHost(hostname) {
  const host = resolveHostname(hostname);
  if (DEV_CAPTURE_LOCAL_HOSTS.includes(host)) {
    return true;
  }
  return DEV_CAPTURE_PREVIEW_HOST_PATTERN.test(host);
}

/**
 * @param {string} [hostname]
 * @returns {boolean}
 */
export function isDevCaptureRoutesEnabled(hostname) {
  if (import.meta.env.DEV) {
    return true;
  }
  return isDevCaptureAllowedHost(hostname);
}
